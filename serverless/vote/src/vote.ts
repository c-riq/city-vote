import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import crypto from 'crypto';
import {
    City,
    VoteData,
    ValidateTokenParams,
    VoteParams,
    CreatePollParams,
    GetUploadUrlParams,
    UserProfile,
    CityAssociation
} from './types';

const s3Client = new S3Client({ region: 'us-east-1' });

const isDev = process.env.CITY_VOTE_ENV === 'dev';
const BUCKET_NAME = isDev ? 'city-vote-data-dev' : 'city-vote-data';
const PUBLIC_BUCKET_NAME = isDev ? 'city-vote-data-public-dev' : 'city-vote-data-public';

const VOTES_KEY = 'votes/votes.json';
const LOCK_KEY = 'votes/lock.csv';
const ACCESS_LOG_KEY = 'logs/access.json';
const USERS_PATH = 'users';
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

// Helper function to fetch user from S3 based on email
async function fetchUserFromS3(email: string): Promise<UserProfile | null> {
    try {
        const partition = email.charAt(0).toLowerCase();
        const userFilePath = `${USERS_PATH}/${partition}/users.json`;
        
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: userFilePath,
        });
        const response = await s3Client.send(command);
        if (!response.Body) {
            return null;
        }
        const data = await streamToString(response.Body as Readable);
        const users: Record<string, UserProfile> = JSON.parse(data);
        return users[email] || null;
    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            return null;
        }
        throw error;
    }
}

// Validate user session token and return associated city
async function validateUserToken(token: string): Promise<{ user: UserProfile; cityAssociation: CityAssociation } | null> {
    try {
        // Token format: email:sessionToken
        const [email, sessionToken] = token.split(':');
        if (!email || !sessionToken) {
            return null;
        }

        const user = await fetchUserFromS3(email);
        if (!user || !user.sessions) {
            return null;
        }

        // Validate session token
        const currentTime = Math.floor(Date.now() / 1000);
        const isValidToken = user.sessions.some(userToken => {
            const [tokenValue, expiry] = userToken.split('_');
            return userToken === sessionToken && parseInt(expiry) > currentTime;
        });

        if (!isValidToken) {
            return null;
        }

        // Check if user has city associations
        if (!user.cityAssociations || user.cityAssociations.length === 0) {
            return null;
        }

        // For now, use the first city association with isAuthorisedRepresentative = true
        const authorizedAssociation = user.cityAssociations.find(assoc => assoc.isAuthorisedRepresentative);
        if (!authorizedAssociation) {
            return null;
        }

        return { user, cityAssociation: authorizedAssociation };
    } catch (error) {
        console.error('Error validating user token:', error);
        return null;
    }
}

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

const handleVote = async ({ cityId, resolvedCity, pollId, option, title, name, actingCapacity, externalVerificationSource, userCityAssociation }: VoteParams): Promise<APIGatewayProxyResult> => {
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

    // Validate that the user is authorized to vote for this city
    if (!userCityAssociation || !userCityAssociation.isAuthorisedRepresentative) {
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'User is not authorized to vote for this city'
            }, null, 2)
        };
    }

    // Validate confidence level (require at least 0.5 confidence)
    if (userCityAssociation.confidence < 0.5) {
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Insufficient confidence level for city association'
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
            associatedCityId: resolvedCity.id,
            cityAssociation: {
                title: userCityAssociation.title,
                confidence: userCityAssociation.confidence,
                identityVerifiedBy: userCityAssociation.identityVerifiedBy,
                verificationTime: userCityAssociation.time
            },
            ...(externalVerificationSource ? { externalVerificationSource: externalVerificationSource } : {})
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

const handleCreatePoll = async ({ pollId, documentUrl, organisedBy }: CreatePollParams): Promise<APIGatewayProxyResult> => {
    if (!pollId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Missing required parameter: pollId' }, null, 2)
        };
    }
    
    // Note: For polls with attachments, the pollId must be in the format <poll_question>_attachment_<hash>
    // This is enforced in the getUploadUrl function

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

const generatePutPresignedUrl = async (pollId: string, contentType: string, fileHash: string): Promise<{url: string, key: string}> => {
    if (!fileHash) {
        throw new Error('File hash is required for attachment ID');
    }
    
    const attachmentKey = `attachments/${fileHash}.pdf`;
    const command = new PutObjectCommand({
        Bucket: PUBLIC_BUCKET_NAME,
        Key: attachmentKey,
        ContentType: contentType
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    return { url, key: attachmentKey };
};

const getAttachmentDirectUrl = (hash: string): string => {
    return `https://${PUBLIC_BUCKET_NAME}.s3.amazonaws.com/attachments/${hash}.pdf`;
};

const getUploadUrl = async ({ resolvedCity, pollId, fileHash }: GetUploadUrlParams): Promise<APIGatewayProxyResult> => {
    if (!pollId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Missing required parameter: pollId' }, null, 2)
        };
    }

    if (!fileHash) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Missing required parameter: fileHash (attachment ID)' }, null, 2)
        };
    }

    try {
        if (!pollId.includes('_attachment_')) {
            pollId = `${pollId}_attachment_${fileHash}`;
        }
        
        const contentType = 'application/pdf';
        const { url: uploadUrl, key: attachmentKey } = await generatePutPresignedUrl(pollId, contentType, fileHash);
        const getUrl = getAttachmentDirectUrl(fileHash);
        
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

// Update action handlers type
type ActionHandlers = {
    validateToken: (params: ValidateTokenParams) => Promise<APIGatewayProxyResult>;
    vote: (params: VoteParams) => Promise<APIGatewayProxyResult>;
    createPoll: (params: CreatePollParams) => Promise<APIGatewayProxyResult>;
    getUploadUrl: (params: GetUploadUrlParams) => Promise<APIGatewayProxyResult>;
};

const actionHandlers: ActionHandlers = {
    validateToken: handleValidateToken,
    vote: handleVote,
    createPoll: handleCreatePoll,
    getUploadUrl: getUploadUrl
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

        const { action, cityId, token, pollId, option, title, name, actingCapacity, externalVerificationSource, documentUrl, organisedBy, fileHash } = JSON.parse(event.body);
        
        if (!action) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Missing required parameter: action'
                }, null, 2)
            };
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

        // Validate token and get user with city association
        let resolvedCity: City;
        let userCityAssociation: CityAssociation;
        try {
            const authResult = await validateUserToken(token);
            if (!authResult) {
                return {
                    statusCode: 403,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Invalid token or no authorized city association' }, null, 2)
                };
            }

            const { user, cityAssociation } = authResult;
            userCityAssociation = cityAssociation;

            // Create a minimal City object from the city association
            // Note: In a real implementation, you might want to fetch full city data from another source
            resolvedCity = {
                id: cityAssociation.cityId,
                name: cityAssociation.title.replace(/^(Mayor of|Representative of)\s+/i, ''),
                population: 0, // This would need to be fetched from city data
                country: '', // This would need to be fetched from city data
                lat: 0, // This would need to be fetched from city data
                lon: 0, // This would need to be fetched from city data
                authenticationKeyDistributionChannels: []
            };

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
        } else if (action === 'getUploadUrl') {
            return await handler({ resolvedCity, token, pollId, fileHash } as any);
        } else {
            return await handler({ cityId, resolvedCity, token, pollId, option, title, name, actingCapacity, externalVerificationSource, userCityAssociation } as any);
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
