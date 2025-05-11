import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import {
    City,
    VoteData,
    GetPublicVotesRequest,
    GetPublicCitiesRequest
} from './types';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = 'city-vote-data';
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
            const cityVotes: Record<string, [number, string, { title: string; name: string; } | undefined][]> = {};
            Object.entries(votes).forEach(([pollId, pollData]: [string, any]) => {
                if (pollData[cityId]) {
                    cityVotes[pollId] = pollData[cityId];
                }
            });
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ votes: cityVotes }, null, 2)
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

const handleGetPublicCities = async (): Promise<APIGatewayProxyResult> => {
    try {
        const cityData = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: 'cities/cities.json'
        }));

        if (!cityData.Body) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Cities data not found' }, null, 2)
            };
        }

        const citiesString = await streamToString(cityData.Body as Readable);
        const cities = JSON.parse(citiesString);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cities }, null, 2)
        };
    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Cities data not found' }, null, 2)
            };
        }
        throw error;
    }
};

// Public action handlers type
type PublicActionHandlers = {
    getVotes: (cityId?: string) => Promise<APIGatewayProxyResult>;
    getCities: () => Promise<APIGatewayProxyResult>;
};

const publicActionHandlers: PublicActionHandlers = {
    getVotes: handleGetPublicVotes,
    getCities: handleGetPublicCities,
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

        const { action, cityId } = JSON.parse(event.body);
        
        if (!action) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Missing required parameter: action'
                }, null, 2)
            };
        }

        const handler = publicActionHandlers[action as keyof PublicActionHandlers];
        if (!handler) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Invalid action: ${action}. Supported actions are: ${Object.keys(publicActionHandlers).join(', ')}`
                }, null, 2)
            };
        }

        // Call the appropriate handler based on the action
        if (action === 'getVotes') {
            return await handler(cityId);
        } else {
            return await handler();
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
