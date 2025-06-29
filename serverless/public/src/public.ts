import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import {
    City,
} from './types';
import { handleRegister } from './registration';

const s3Client = new S3Client({ region: 'us-east-1' });
// Check if running in dev environment based on environment variable
const isDev = process.env.CITY_VOTE_ENV === 'dev';
const BUCKET_NAME = isDev ? 'city-vote-data-dev' : 'city-vote-data';

const VOTES_KEY = 'votes/votes.json';

async function streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
    });
}

// Public action handlers (no authentication required)
const handleGetPublicVotes = async (cityId?: string): Promise<APIGatewayProxyResult> => {
    try {
        const votesData = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: VOTES_KEY
        }));
        
        if (!votesData.Body) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'No votes data found' }, null, 2)
            };
        }

        const votesString = await streamToString(votesData.Body as Readable);
        const votes = JSON.parse(votesString);

        // If cityId is specified, filter votes for that city only
        if (cityId) {
            const filteredVotes: Record<string, any> = {};
            
            // Filter each poll's votes to only include those from the specified city
            Object.entries(votes).forEach(([pollId, pollData]: [string, any]) => {
                if (pollData.votes) {
                    // Filter votes array to only include votes from the specified city
                    const cityVotes = pollData.votes.filter((vote: any) => vote.associatedCityId === cityId);
                    
                    if (cityVotes.length > 0) {
                        // Create a copy of the poll data with only the filtered votes
                        filteredVotes[pollId] = {
                            ...pollData,
                            votes: cityVotes
                        };
                    }
                }
            });
            
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ votes: filteredVotes }, null, 2)
            };
        }

        // Otherwise return all votes data
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ votes }, null, 2)
        };
    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'No votes data found' }, null, 2)
            };
        }
        throw error;
    }
};

// Public action handlers type
type PublicActionHandlers = {
    getVotes: (cityId?: string) => Promise<APIGatewayProxyResult>;
    register: (cityData: City) => Promise<APIGatewayProxyResult>;
};

const publicActionHandlers: PublicActionHandlers = {
    getVotes: handleGetPublicVotes,
    register: handleRegister,
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Missing request body' }, null, 2)
            };
        }

        const { action, cityId, cityData } = JSON.parse(event.body);
        
        if (!action) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Missing required parameter: action'
                }, null, 2)
            };
        }

        // Call the appropriate handler based on the action
        if (action === 'getVotes') {
            return await publicActionHandlers.getVotes(cityId);
        } else if (action === 'register') {
            return await publicActionHandlers.register(cityData);
        }
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Invalid action: ${action}. Supported actions are: ${Object.keys(publicActionHandlers).join(', ')}`
            }, null, 2)
        };
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
