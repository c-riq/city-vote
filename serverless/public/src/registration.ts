import { APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { City, RegisterRequest, RegisterResponse } from './types';

const s3Client = new S3Client({ region: 'us-east-1' });
const BUCKET_NAME = 'city-vote-data';
const REGISTRATION_KEY = 'registration/registration.json';

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
        // Get existing registration data
        let registrations: Record<string, City> = {};
        try {
            const registrationData = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: REGISTRATION_KEY
            }));

            if (registrationData.Body) {
                const registrationString = await streamToString(registrationData.Body as Readable);
                registrations = JSON.parse(registrationString);
            }
        } catch (error) {
            console.error('Error getting registration data:', error);
            // If the file doesn't exist yet, we'll create it
        }

        // Check if city with same name already exists in registration.json
        const cityExistsInRegistration = Object.values(registrations).some(city => 
            city.name.toLowerCase() === cityData.name.toLowerCase());
        
        if (cityExistsInRegistration) {
            return {
                statusCode: 409,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `City with name "${cityData.name}" already exists in registration data`
                }, null, 2)
            };
        }

        // Use the ID provided in the registration data
        const cityId = cityData.id;
        
        // Use the city object from the registration data
        const city: City = cityData;

        // Add the city to the registration data
        registrations[cityId] = city;

        // Update the registration data
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: REGISTRATION_KEY,
            Body: JSON.stringify(registrations, null, 2),
            ContentType: 'application/json'
        }));

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Registration successful',
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
