import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AutocompleteRequest, AutocompleteResponse } from './types';
import { CITY_DATA } from './city-data';
import { countries } from './countries';

const handleAutocomplete = async (query: string, limit: number = 10): Promise<APIGatewayProxyResult> => {
    if (!query) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Missing required parameter: query'
            }, null, 2)
        };
    }

    try {
        // Normalize the query for case-insensitive search
        const normalizedQuery = query.toLowerCase();
        
        // Create maps for country wikidata IDs to country names and ISO codes
        const countryNameMap = new Map<string, string>();
        const countryCodeMap = new Map<string, string>();
        countries.countries.forEach(country => {
            if (country[4]) { // Check if wikidata id exists
                countryNameMap.set(country[4], country[0]);
                countryCodeMap.set(country[4], country[1]); // Alpha-2 code
            }
        });

        // Filter cities based on the query
        const filteredCities = CITY_DATA.cities
            .filter((city: string[]) => city[1].toLowerCase().includes(normalizedQuery))
            .slice(0, limit)
            .map((city: string[]) => {
                const countryName = countryNameMap.get(city[2]) || '';
                const countryCode = countryCodeMap.get(city[2]) || '';
                return {
                    wikidataId: city[0],
                    name: city[1],
                    countryWikidataId: city[2],
                    countryName: countryName,
                    countryCode: countryCode
                };
            });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                results: filteredCities
            }, null, 2)
        };
    } catch (error) {
        console.error('Error during autocomplete:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Autocomplete system error',
                details: error instanceof Error ? error.message : 'Unknown error'
            }, null, 2)
        };
    }
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

        const { action, query, limit } = JSON.parse(event.body) as AutocompleteRequest;
        
        if (!action) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Missing required parameter: action'
                }, null, 2)
            };
        }

        if (action === 'autocomplete') {
            return await handleAutocomplete(query, limit);
        } else {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Invalid action: ${action}. Supported actions are: autocomplete`
                }, null, 2)
            };
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
