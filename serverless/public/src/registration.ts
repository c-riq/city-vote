import { APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { City, RegisterRequest, RegisterResponse } from './types';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = 'city-vote-data';
const AUTH_KEY = 'auth/auth.json';
const CITIES_KEY = 'cities/cities.json';

async function streamToString(stream: Readable): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        stream.on('error', reject);
    });
}

export const handleRegister = async (cityData: City): Promise<APIGatewayProxyResult> => {
    if (!cityData || !cityData.name) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Missing required parameter: cityData'
            }, null, 2)
        };
    }

    try {
        // Get existing auth data
        const authData = await s3Client.send(new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: AUTH_KEY
        }));

        let auth: Record<string, City> = {};
        if (authData.Body) {
            const authString = await streamToString(authData.Body as Readable);
            auth = JSON.parse(authString);
        }

        // Check if city with same name already exists in auth.json
        const cityExistsInAuth = Object.values(auth).some(city => 
            city.name.toLowerCase() === cityData.name.toLowerCase());
        
        if (cityExistsInAuth) {
            return {
                statusCode: 409,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `City with name "${cityData.name}" already exists in authentication data`
                }, null, 2)
            };
        }

        // Get existing cities data to check if city already exists
        let cityExistsInCities = false;
        try {
            const citiesData = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: CITIES_KEY
            }));

            if (citiesData.Body) {
                const citiesString = await streamToString(citiesData.Body as Readable);
                const cities: Record<string, City> = JSON.parse(citiesString);
                
                cityExistsInCities = Object.values(cities).some(city => 
                    city.name.toLowerCase() === cityData.name.toLowerCase());
            }
        } catch (error) {
            console.error('Error checking cities data:', error);
            // Continue with registration even if we can't check cities.json
        }

        if (cityExistsInCities) {
            return {
                statusCode: 409,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `City with name "${cityData.name}" already exists in cities data`
                }, null, 2)
            };
        }

        // Use the ID provided in the registration data
        const cityId = cityData.id;
        
        // Generate a unique token for the city
        const token = `token_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

        // Use the city object from the registration data
        const city: City = cityData;

        // Add the city to the auth data
        auth[token] = city;

        // Update the auth data
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: AUTH_KEY,
            Body: JSON.stringify(auth, null, 2),
            ContentType: 'application/json'
        }));

        // Update cities.json file
        try {
            // Get existing cities data
            const citiesData = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: CITIES_KEY
            }));

            let cities: Record<string, City> = {};
            if (citiesData.Body) {
                const citiesString = await streamToString(citiesData.Body as Readable);
                cities = JSON.parse(citiesString);
            }

            // Add the new city to the cities data
            cities[cityId] = city;

            // Update the cities data
            await s3Client.send(new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: CITIES_KEY,
                Body: JSON.stringify(cities, null, 2),
                ContentType: 'application/json'
            }));
        } catch (error) {
            console.error('Error updating cities data:', error);
            // Don't throw error to prevent disrupting the main flow
            // The city is still registered in auth.json
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Registration successful',
                token,
                city
            }, null, 2)
        };
    } catch (error) {
        console.error('Error during registration:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Registration system error',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, null, 2)
        };
    }
};
