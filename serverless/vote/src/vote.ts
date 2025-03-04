import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import crypto from 'crypto';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = 'city-vote-data';
const VOTES_KEY = 'votes/votes.json';
const LOCK_KEY = 'votes/lock.csv';
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
    const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
    let lockAcquired = false;
    
    try {
        if (!event.body) {
            throw new Error('Missing request body');
        }

        const { pollId, cityId, option } = JSON.parse(event.body);
        
        if (!pollId || !cityId || option === undefined) {
            throw new Error('Missing required parameters');
        }

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
        if (!votes[pollId][cityId]) {
            votes[pollId][cityId] = [];
        }

        // Add new vote with timestamp
        votes[pollId][cityId].push([Date.now(), option]);

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
    } catch (error) {
        console.error('Error:', error);
        if (lockAcquired) {
            await releaseLock(sessionId);
        }
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Internal server error'
            })
        };
    }
}; 