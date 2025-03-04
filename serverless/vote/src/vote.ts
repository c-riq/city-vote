import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = 'city-vote-data';
const VOTES_KEY = 'votes/votes.json';
const LOCK_KEY = 'votes/lock.csv';
const AUTH_KEY = 'auth/auth.json';
const LOCK_TIMEOUT_MS = 10000; // 10 seconds
const LOCK_CHECK_DELAY_MS = 50;

async function streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
    });
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function acquireLock(sessionId: string): Promise<boolean> {
    try {
        // Try to read existing lock
        try {
            const lockData = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: LOCK_KEY
            }));
            
            if (lockData.Body) {
                const lockContent = await streamToString(lockData.Body as Readable);
                const [lockTime, _] = lockContent.split(',');
                const lockTimestamp = parseInt(lockTime);
                
                // Check if lock is expired
                if (Date.now() - lockTimestamp < LOCK_TIMEOUT_MS) {
                    return false;
                }
            }
        } catch (error: any) {
            if (error.name !== 'NoSuchKey') {
                throw error;
            }
        }

        // Create new lock
        const timestamp = Date.now();
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: LOCK_KEY,
            Body: `${timestamp},${sessionId}`,
            ContentType: 'text/csv'
        }));

        // Wait and verify lock
        await sleep(LOCK_CHECK_DELAY_MS);
        
        const verifyLock = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: LOCK_KEY
        }));
        
        const verifyContent = await streamToString(verifyLock.Body as Readable);
        const [verifyTime, verifySession] = verifyContent.split(',');
        
        return verifySession === sessionId;
    } catch (error) {
        console.error('Error acquiring lock:', error);
        return false;
    }
}

async function releaseLock(sessionId: string): Promise<void> {
    try {
        // Verify we still own the lock before deleting
        const lockData = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: LOCK_KEY
        }));
        
        const lockContent = await streamToString(lockData.Body as Readable);
        const [_, lockSession] = lockContent.split(',');
        
        if (lockSession === sessionId) {
            await s3Client.send(new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: LOCK_KEY
            }));
        }
    } catch (error) {
        console.error('Error releasing lock:', error);
    }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Missing request body'
                })
            };
        }

        const { action, cityId, token, pollId, option } = JSON.parse(event.body);
        
        if (!action || !token) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Missing required parameters: ${[
                        !action && 'action',
                        !token && 'token'
                    ].filter(Boolean).join(', ')}`
                })
            };
        }

        // Get auth data
        let resolvedCityId: string;
        try {
            const authData = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: AUTH_KEY
            }));
            
            if (!authData.Body) {
                return {
                    statusCode: 500,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: 'Authentication system unavailable'
                    })
                };
            }

            const authString = await streamToString(authData.Body as Readable);
            const auth: Record<string, string> = JSON.parse(authString);

            resolvedCityId = auth[token];
            if (!resolvedCityId) {
                return {
                    statusCode: 403,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: 'Invalid token'
                    })
                };
            }

            // For vote action, verify provided cityId matches token
            if (action === 'vote' && cityId && cityId !== resolvedCityId) {
                return {
                    statusCode: 403,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: 'Token does not match the specified city'
                    })
                };
            }
        } catch (error) {
            console.error('Error validating token:', error);
            return {
                statusCode: 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Authentication system error',
                    details: error instanceof Error ? error.message : 'Unknown error'
                })
            };
        }

        // Handle different actions
        if (action === 'validateToken') {
            // Get city information using resolved cityId
            const cityData = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: 'cities/cities.json'
            }));

            if (!cityData.Body) {
                throw new Error('City data not found');
            }

            const citiesString = await streamToString(cityData.Body as Readable);
            const cities: Record<string, any> = JSON.parse(citiesString);

            if (!cities[resolvedCityId]) {
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: 'City not found'
                    })
                };
            }

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    city: cities[resolvedCityId],
                    cityId: resolvedCityId
                })
            };
        } else if (action === 'vote') {
            if (!pollId || option === undefined) {
                return {
                    statusCode: 400,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Missing required parameters for voting: ${[
                            !pollId && 'pollId',
                            option === undefined && 'option'
                        ].filter(Boolean).join(', ')}`
                    })
                };
            }

            const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
            let lockAcquired = false;

            // Acquire lock
            lockAcquired = await acquireLock(sessionId);
            if (!lockAcquired) {
                return {
                    statusCode: 429,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: 'Failed to acquire lock, please try again'
                    })
                };
            }

            try {
                // Get existing votes or create new structure
                let votes: Record<string, Record<string, [number, number][]>> = {};
                try {
                    const existingData = await s3Client.send(new GetObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: VOTES_KEY
                    }));
                    
                    if (existingData.Body) {
                        const dataString = await streamToString(existingData.Body as Readable);
                        votes = JSON.parse(dataString);
                    }
                } catch (error: any) {
                    if (error.name !== 'NoSuchKey') {
                        throw error;
                    }
                }

                // Initialize poll and city if they don't exist
                if (!votes[pollId]) {
                    votes[pollId] = {};
                }
                if (!votes[pollId][resolvedCityId]) {
                    votes[pollId][resolvedCityId] = [];
                }

                // Add new vote with timestamp
                votes[pollId][resolvedCityId].push([Date.now(), option]);

                // Save updated votes back to S3
                await s3Client.send(new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: VOTES_KEY,
                    Body: JSON.stringify(votes),
                    ContentType: 'application/json'
                }));

                await releaseLock(sessionId);

                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: 'Vote recorded successfully'
                    })
                };
            } finally {
                if (lockAcquired) {
                    await releaseLock(sessionId);
                }
            }
        } else {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Invalid action: ${action}. Supported actions are 'validateToken' and 'vote'`
                })
            };
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
}; 