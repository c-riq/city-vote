import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';
import {
    City,
    VoteData,
} from './types';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = 'city-vote-data';
const VOTES_KEY = 'votes/votes.json';
const LOCK_KEY = 'votes/lock.csv';
const AUTH_KEY = 'auth/auth.json';
const ACCESS_LOG_KEY = 'logs/access.json';
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

async function releaseLock(): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: LOCK_KEY
    }));
}

async function logAccess(city: City, action: string): Promise<void> {
    try {
        const logEntry = {
            time: new Date().toISOString(),
            city: city.name,
            action: action
        };
        
        let logs: any[] = [];
        try {
            const logsData = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: ACCESS_LOG_KEY
            }));
            
            if (logsData.Body) {
                const logsString = await streamToString(logsData.Body as Readable);
                logs = JSON.parse(logsString);
            }
        } catch (error: any) {
            if (error.name !== 'NoSuchKey') {
                throw error;
            }
        }

        logs.push(logEntry);

        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: ACCESS_LOG_KEY,
            Body: JSON.stringify(logs, null, 2),
            ContentType: 'application/json'
        }));
    } catch (error) {
        console.error('Error logging access:', error);
        // Don't throw error to prevent disrupting the main flow
    }
}

// Update interface to use imported type
interface ValidateTokenParams {
    resolvedCity: City;
    token: string;
}

interface VoteParams {
    cityId?: string;
    resolvedCity: City;
    token: string;
    pollId: string;
    option: string;
    title: string;
    name: string;
    actingCapacity: 'individual' | 'representingCityAdministration';
}

interface GetVotesParams {
    cityId?: string;
    resolvedCity: City;
    token: string;
}

interface GetCitiesParams {
    resolvedCity: City;
    token: string;
}

interface CreatePollParams {
    resolvedCity: City;
    token: string;
    pollId: string;
}

// Update action handlers with specific types
const handleValidateToken = async ({ resolvedCity }: ValidateTokenParams): Promise<APIGatewayProxyResult> => {
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            city: resolvedCity,
            cityId: resolvedCity.id
        })
    };
};

const handleVote = async ({ cityId, resolvedCity, pollId, option, title, name, actingCapacity }: VoteParams): Promise<APIGatewayProxyResult> => {
    if (!pollId || option === undefined || !title || !name || !actingCapacity) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Missing required parameters for voting: ${[
                    !pollId && 'pollId',
                    option === undefined && 'option',
                    !title && 'title',
                    !name && 'name',
                    !actingCapacity && 'actingCapacity'
                ].filter(Boolean).join(', ')}`
            })
        };
    }

    if (cityId && cityId !== resolvedCity.id) {
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Token does not match the specified city'
            })
        };
    }

    const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
    let lockAcquired = false;

    lockAcquired = await acquireLock(sessionId);
    if (!lockAcquired) {
        return {
            statusCode: 429,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Failed to acquire lock, please try again'
            })
        };
    }

    try {
        let votes: VoteData = {};
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

        if (!votes[pollId]) votes[pollId] = {};
        if (!votes[pollId][resolvedCity.id]) votes[pollId][resolvedCity.id] = [];

        votes[pollId][resolvedCity.id].push([
            Date.now(), 
            option, 
            { title, name, actingCapacity }
        ]);

        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: VOTES_KEY,
            Body: JSON.stringify(votes),
            ContentType: 'application/json'
        }));
        await releaseLock();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Vote recorded successfully' })
        };
    } catch (error) {
        if (lockAcquired) {
            await releaseLock();
        }
        throw error;
    }
};

const handleGetVotes = async ({ resolvedCity, cityId }: GetVotesParams): Promise<APIGatewayProxyResult> => {
    try {
        const votesData = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: VOTES_KEY
        }));
        
        if (!votesData.Body) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'No votes data found' })
            };
        }

        const votesString = await streamToString(votesData.Body as Readable);
        const votes = JSON.parse(votesString);

        // If cityId is specified, filter votes for that city only
        if (cityId) {
            const cityVotes: Record<string, [number, string, { title: string; name: string; } | undefined][]> = {};
            Object.entries(votes).forEach(([pollId, pollData]: [string, any]) => {
                if (pollData[cityId]) {
                    cityVotes[pollId] = pollData[cityId];
                }
            });
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ votes: cityVotes })
            };
        }

        // Otherwise return all votes data
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ votes })
        };
    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'No votes data found' })
            };
        }
        throw error;
    }
};

const handleGetCities = async ({ resolvedCity }: GetCitiesParams): Promise<APIGatewayProxyResult> => {
    try {
        const cityData = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: 'cities/cities.json'
        }));

        if (!cityData.Body) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Cities data not found' })
            };
        }

        const citiesString = await streamToString(cityData.Body as Readable);
        const cities = JSON.parse(citiesString);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cities })
        };
    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Cities data not found' })
            };
        }
        throw error;
    }
};

const handleCreatePoll = async ({ pollId }: CreatePollParams): Promise<APIGatewayProxyResult> => {
    if (!pollId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Missing required parameter: pollId' })
        };
    }

    const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
    let lockAcquired = false;

    lockAcquired = await acquireLock(sessionId);
    if (!lockAcquired) {
        return {
            statusCode: 429,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Failed to acquire lock, please try again' })
        };
    }

    try {
        let votes: VoteData = {};
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

        // Check if poll already exists
        if (votes[pollId]) {
            await releaseLock();
            return {
                statusCode: 409,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Poll already exists' })
            };
        }

        // Initialize empty poll
        votes[pollId] = {};

        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: VOTES_KEY,
            Body: JSON.stringify(votes),
            ContentType: 'application/json'
        }));
        await releaseLock();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Poll created successfully' })
        };
    } catch (error) {
        if (lockAcquired) {
            await releaseLock();
        }
        throw error;
    }
};

// Update action handlers type
type ActionHandlers = {
    validateToken: (params: ValidateTokenParams) => Promise<APIGatewayProxyResult>;
    vote: (params: VoteParams) => Promise<APIGatewayProxyResult>;
    getVotes: (params: GetVotesParams) => Promise<APIGatewayProxyResult>;
    getCities: (params: GetCitiesParams) => Promise<APIGatewayProxyResult>;
    createPoll: (params: CreatePollParams) => Promise<APIGatewayProxyResult>;
};

const actionHandlers: ActionHandlers = {
    validateToken: handleValidateToken,
    vote: handleVote,
    getVotes: handleGetVotes,
    getCities: handleGetCities,
    createPoll: handleCreatePoll,
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Missing request body' })
            };
        }

        const { action, cityId, token, pollId, option, title, name, actingCapacity } = JSON.parse(event.body);
        
        if (!action || !token) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Missing required parameters: ${[
                        !action && 'action',
                        !token && 'token'
                    ].filter(Boolean).join(', ')}`
                })
            };
        }

        // Validate token and get resolvedCity
        let resolvedCity: City;
        try {
            const authData = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: AUTH_KEY
            }));
            
            if (!authData.Body) {
                return {
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Authentication system unavailable' })
                };
            }

            const authString = await streamToString(authData.Body as Readable);
            const auth: Record<string, City> = JSON.parse(authString);

            resolvedCity = auth[token];
            if (!resolvedCity) {
                return {
                    statusCode: 403,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Invalid token' })
                };
            }

            // Log successful access
            await logAccess(resolvedCity, action);
        } catch (error) {
            console.error('Error validating token:', error);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Authentication system error',
                    details: error instanceof Error ? error.message : 'Unknown error'
                })
            };
        }

        const handler = actionHandlers[action as keyof ActionHandlers];
        if (!handler) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Invalid action: ${action}. Supported actions are: ${Object.keys(actionHandlers).join(', ')}`
                })
            };
        }

        // Type assertion to ensure correct params are passed to each handler
        return await handler({ cityId, resolvedCity, token, pollId, option, title, name, actingCapacity } as any);
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};
