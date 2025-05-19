import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import crypto from 'crypto';
import { createHash } from 'crypto';
import {
    City,
    VoteData,
} from './types';

const s3Client = new S3Client({ region: 'us-east-1' });
// Check if running in dev environment based on environment variable
const isDev = process.env.CITY_VOTE_ENV === 'dev';
const BUCKET_NAME = isDev ? 'city-vote-data-dev' : 'city-vote-data';
const PUBLIC_BUCKET_NAME = isDev ? 'city-vote-data-public-dev' : 'city-vote-data-public';

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
    externallyVerifiedBy?: string; // Platform that verified this vote
}

interface CreatePollParams {
    resolvedCity: City;
    token: string;
    pollId: string;
    documentUrl?: string;
    organisedBy?: string;
}

interface UploadAttachmentParams {
    resolvedCity: City;
    token: string;
    pollId: string;
    contentType?: string;
    attachmentId?: string;
}

// Helper function to create a URL-safe base64 SHA-256 hash
const createUrlSafeB64Hash = (input: string): string => {
    const hash = createHash('sha256').update(input).digest('base64');
    return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// Update action handlers with specific types
const handleValidateToken = async ({ resolvedCity }: ValidateTokenParams): Promise<APIGatewayProxyResult> => {
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            city: resolvedCity,
            cityId: resolvedCity.id
        }, null, 2)
    };
};

const handleVote = async ({ cityId, resolvedCity, pollId, option, title, name, actingCapacity, externallyVerifiedBy }: VoteParams): Promise<APIGatewayProxyResult> => {
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
            }, null, 2)
        };
    }

    if (cityId && cityId !== resolvedCity.id) {
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Token does not match the specified city'
            }, null, 2)
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
            }, null, 2)
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

        // For polls with attachments, the title displayed in the UI should have the _attachment_<hash> part removed
        let displayTitle = title;
        if (pollId.includes('_attachment_')) {
            // If the title still contains the _attachment_<hash> part, remove it for display
            const attachmentIndex = title.indexOf('_attachment_');
            if (attachmentIndex !== -1) {
                displayTitle = title.substring(0, attachmentIndex);
            }
        }
        
        // Check if poll exists, if not create it with default values
        if (!votes[pollId]) {
            const isJointStatement = pollId.startsWith('joint_statement_');
            votes[pollId] = {
                type: isJointStatement ? 'jointStatement' : 'poll',
                votes: []
            };
        }
        
        // Create the vote entry with the new structure
        const voteEntry = {
            time: Date.now(),
            vote: option as 'Yes' | 'No' | 'Sign',
            author: {
                title: displayTitle,
                name,
                actingCapacity
            },
            associatedCity: resolvedCity.id,
            ...(externallyVerifiedBy ? { externalVerificationSource: externallyVerifiedBy } : {})
        };
        
        // Add the vote to the poll's votes array
        votes[pollId].votes.push(voteEntry);

        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: VOTES_KEY,
            Body: JSON.stringify(votes, null, 2), // Format JSON with 2-space indentation
            ContentType: 'application/json'
        }));
        await releaseLock();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Vote recorded successfully' }, null, 2)
        };
    } catch (error) {
        if (lockAcquired) {
            await releaseLock();
        }
        throw error;
    }
};

// Interface for poll metadata
interface PollMetadata {
    [pollId: string]: {
        documentUrl?: string;
        organisedBy?: string;
        createdAt: number;
    };
}

const handleCreatePoll = async ({ pollId, documentUrl, organisedBy }: CreatePollParams): Promise<APIGatewayProxyResult> => {
    if (!pollId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Missing required parameter: pollId' }, null, 2)
        };
    }
    
    // Note: For polls with attachments, the pollId must be in the format <poll_question>_attachment_<hash>
    // This is enforced in the handleUploadAttachment function

    const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
    let lockAcquired = false;

    lockAcquired = await acquireLock(sessionId);
    if (!lockAcquired) {
        return {
            statusCode: 429,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Failed to acquire lock, please try again' }, null, 2)
        };
    }

    try {
        // Handle votes data with new structure
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
                body: JSON.stringify({ message: 'Poll already exists' }, null, 2)
            };
        }

        // Determine poll type based on pollId
        const isJointStatement = pollId.startsWith('joint_statement_');
        
        // Initialize new poll with the new structure
        votes[pollId] = {
            type: isJointStatement ? 'jointStatement' : 'poll',
            votes: [],
            createdAt: Date.now(),
            ...(documentUrl ? { URL: documentUrl } : {}),
            ...(organisedBy ? { organisedBy } : {})
        };

        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: VOTES_KEY,
            Body: JSON.stringify(votes, null, 2), // Format JSON with 2-space indentation
            ContentType: 'application/json'
        }));

        await releaseLock();

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: 'Poll created successfully',
                pollId,
                metadata: {
                    type: votes[pollId].type,
                    ...(votes[pollId].URL ? { URL: votes[pollId].URL } : {}),
                    ...(votes[pollId].organisedBy ? { organisedBy: votes[pollId].organisedBy } : {})
                }
            }, null, 2)
        };
    } catch (error) {
        if (lockAcquired) {
            await releaseLock();
        }
        throw error;
    }
};

// No multipart form data parsing needed - using only JSON

// Interface for getAttachmentUrl params
interface GetAttachmentUrlParams {
    resolvedCity?: City;
    token?: string;
    pollId: string;
    attachmentId?: string;
}

// Interface for getPollMetadata params
interface GetPollMetadataParams {
    resolvedCity?: City;
    token?: string;
    pollId: string;
}

// Handler for getting poll metadata
const handleGetPollMetadata = async ({ pollId }: GetPollMetadataParams): Promise<APIGatewayProxyResult> => {
    if (!pollId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Missing required parameter: pollId' }, null, 2)
        };
    }

    try {
        // Get poll data from votes file
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

        // Check if poll exists
        if (!votes[pollId]) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Poll not found' }, null, 2)
            };
        }

        // Extract metadata from poll data
        const metadata = {
            type: votes[pollId].type,
            ...(votes[pollId].URL ? { documentUrl: votes[pollId].URL } : {}),
            ...(votes[pollId].organisedBy ? { organisedBy: votes[pollId].organisedBy } : {}),
            createdAt: votes[pollId].createdAt || Date.now()
        };

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: 'Poll metadata retrieved successfully',
                metadata
            }, null, 2)
        };
    } catch (error) {
        console.error('Error retrieving poll metadata:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Failed to retrieve poll metadata',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, null, 2)
        };
    }
};

// Update action handlers type
type ActionHandlers = {
    validateToken: (params: ValidateTokenParams) => Promise<APIGatewayProxyResult>;
    vote: (params: VoteParams) => Promise<APIGatewayProxyResult>;
    createPoll: (params: CreatePollParams) => Promise<APIGatewayProxyResult>;
    uploadAttachment: (params: UploadAttachmentParams) => Promise<APIGatewayProxyResult>;
    getAttachmentUrl: (params: GetAttachmentUrlParams) => Promise<APIGatewayProxyResult>;
    getPollMetadata: (params: GetPollMetadataParams) => Promise<APIGatewayProxyResult>;
};

// Get the direct URL for an attachment (bucket is public)
const getAttachmentDirectUrl = (hash: string): string => {
    // Create the attachment key using the hash
    const attachmentKey = `attachments/${hash}.pdf`;
    
    // Return direct URL to the public bucket
    return `https://${PUBLIC_BUCKET_NAME}.s3.amazonaws.com/${attachmentKey}`;
};

// Generate a presigned URL for uploading an attachment
const generatePutPresignedUrl = async (pollId: string, contentType: string, attachmentId?: string): Promise<string> => {
    // Use the provided attachmentId or generate one if not provided
    const hash = attachmentId || createUrlSafeB64Hash(pollId);
    
    // Create the attachment key using just the hash
    const attachmentKey = `attachments/${hash}.pdf`;
    
    // Create the command for putting the object
    const command = new PutObjectCommand({
        Bucket: PUBLIC_BUCKET_NAME,
        Key: attachmentKey,
        ContentType: contentType
    });
    
    // Generate a presigned URL that expires in 15 minutes (900 seconds)
    return await getSignedUrl(s3Client, command, { expiresIn: 900 });
};

const handleUploadAttachment = async ({ resolvedCity, pollId, attachmentId }: UploadAttachmentParams): Promise<APIGatewayProxyResult> => {
    if (!pollId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Missing required parameter: pollId' }, null, 2)
        };
    }

    try {
        // Use the provided attachmentId or generate one if not provided
        const hash = attachmentId || createUrlSafeB64Hash(pollId);
        
        // Ensure pollId follows the required format for attachments: <poll_question>_attachment_<hash>
        // Check if pollId already has the correct format
        if (!pollId.includes('_attachment_')) {
            pollId = `${pollId}_attachment_${hash}`;
        }
        
        // Generate presigned URL for upload and direct URL for retrieval
        const contentType = 'application/pdf';
        const uploadUrl = await generatePutPresignedUrl(pollId, contentType, attachmentId);
        const getUrl = getAttachmentDirectUrl(hash);
        
        // Return the presigned URL for upload, direct URL for retrieval, and the formatted pollId
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: 'Presigned URLs generated successfully',
                uploadUrl,
                getUrl,
                pollId
            }, null, 2)
        };
    } catch (error) {
        console.error('Error handling attachment:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Failed to process attachment request',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, null, 2)
        };
    }
};

// Handler for getting a direct URL for an attachment
const handleGetAttachmentUrl = async ({ pollId, attachmentId }: GetAttachmentUrlParams): Promise<APIGatewayProxyResult> => {
    if (!pollId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Missing required parameter: pollId' }, null, 2)
        };
    }

    try {
        // Use the provided attachmentId or generate one if not provided
        const hash = attachmentId || createUrlSafeB64Hash(pollId);
        
        // Ensure pollId follows the required format for attachments: <poll_question>_attachment_<hash>
        // Check if pollId already has the correct format
        if (!pollId.includes('_attachment_')) {
            pollId = `${pollId}_attachment_${hash}`;
        }
        
        // Create the attachment key using just the hash
        const attachmentKey = `attachments/${hash}.pdf`;
        
        // Check if the attachment exists
        try {
            await s3Client.send(new GetObjectCommand({
                Bucket: PUBLIC_BUCKET_NAME,
                Key: attachmentKey
            }));
            
            // If we get here, the attachment exists, so return the direct URL
            const directUrl = getAttachmentDirectUrl(hash);
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: 'Attachment URL generated successfully',
                    attachmentUrl: directUrl
                }, null, 2)
            };
        } catch (error: any) {
            if (error.name === 'NoSuchKey') {
                // Attachment doesn't exist
                return {
                    statusCode: 404,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Attachment not found' }, null, 2)
                };
            }
            throw error;
        }
    } catch (error) {
        console.error('Error generating attachment URL:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Failed to generate attachment URL',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, null, 2)
        };
    }
};

const actionHandlers: ActionHandlers = {
    validateToken: handleValidateToken,
    vote: handleVote,
    createPoll: handleCreatePoll,
    uploadAttachment: handleUploadAttachment,
    getAttachmentUrl: handleGetAttachmentUrl,
    getPollMetadata: handleGetPollMetadata
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {

        // Handle regular JSON requests
        if (!event.body) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Missing request body' }, null, 2)
            };
        }

        const { action, cityId, token, pollId, option, title, name, actingCapacity, externallyVerifiedBy, documentUrl, organisedBy } = JSON.parse(event.body);
        
        if (!action) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Missing required parameter: action'
                }, null, 2)
            };
        }
        
        // Special cases that don't require token validation
        if (action === 'getAttachmentUrl') {
            const { pollId, attachmentId } = JSON.parse(event.body);
            return await handleGetAttachmentUrl({ pollId, attachmentId });
        }
        
        if (action === 'getPollMetadata') {
            const { pollId } = JSON.parse(event.body);
            return await handleGetPollMetadata({ pollId });
        }
        
        if (!token) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Missing required parameter: token'
                }, null, 2)
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
                    body: JSON.stringify({ message: 'Authentication system unavailable' }, null, 2)
                };
            }

            const authString = await streamToString(authData.Body as Readable);
            const auth: Record<string, City> = JSON.parse(authString);

            resolvedCity = auth[token];
            if (!resolvedCity) {
                return {
                    statusCode: 403,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Invalid token' }, null, 2)
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
                }, null, 2)
            };
        }

        const handler = actionHandlers[action as keyof ActionHandlers];
        if (!handler) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Invalid action: ${action}. Supported actions are: ${Object.keys(actionHandlers).join(', ')}`
                }, null, 2)
            };
        }

        // Type assertion to ensure correct params are passed to each handler
        if (action === 'createPoll') {
            return await handler({ resolvedCity, token, pollId, documentUrl, organisedBy } as any);
        } else {
            return await handler({ cityId, resolvedCity, token, pollId, option, title, name, actingCapacity, externallyVerifiedBy } as any);
        }
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, null, 2)
        };
    }
};
