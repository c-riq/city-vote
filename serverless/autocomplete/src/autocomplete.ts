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
                
                // Parse population as number if it exists
                let population: number | undefined = undefined;
                if (city[3] !== null && city[3] !== undefined) {
                    const parsedPopulation = Number(city[3]);
                    if (!isNaN(parsedPopulation)) {
                        population = parsedPopulation;
                    }
                }
                
                // Get population date if it exists
                const populationDate = city[4] || undefined;
                
                // Parse coordinates if they exist
                let coordinates: { latitude: number; longitude: number } | undefined = undefined;
                if (city[5] && typeof city[5] === 'object') {
                    try {
                        // Parse the coordinates object which might be a string in JSON format
                        const coordObj = typeof city[5] === 'string' ? JSON.parse(city[5]) : city[5] as any;
                        if (coordObj && typeof coordObj === 'object' && 
                            'latitude' in coordObj && 'longitude' in coordObj) {
                            coordinates = {
                                latitude: Number(coordObj.latitude),
                                longitude: Number(coordObj.longitude)
                            };
                        }
                    } catch (e) {
                        console.error('Error parsing coordinates:', e);
                    }
                }
                
                // Parse social media accounts if they exist
                let socialMedia: { 
                    twitter?: string; 
                    facebook?: string; 
                    instagram?: string; 
                    youtube?: string; 
                    linkedin?: string; 
                } | undefined = undefined;
                
                if (city[7] && typeof city[7] === 'object') {
                    try {
                        // Parse the social media object which might be a string in JSON format
                        const socialObj = typeof city[7] === 'string' ? JSON.parse(city[7]) : city[7] as any;
                        if (socialObj && typeof socialObj === 'object') {
                            socialMedia = {};
                            
                            if ('twitter' in socialObj) {
                                socialMedia.twitter = socialObj.twitter;
                            }
                            
                            if ('facebook' in socialObj) {
                                socialMedia.facebook = socialObj.facebook;
                            }
                            
                            if ('instagram' in socialObj) {
                                socialMedia.instagram = socialObj.instagram;
                            }
                            
                            if ('youtube' in socialObj) {
                                socialMedia.youtube = socialObj.youtube;
                            }
                            
                            if ('linkedin' in socialObj) {
                                socialMedia.linkedin = socialObj.linkedin;
                            }
                            
                            // If no social media accounts were found, set to undefined
                            if (Object.keys(socialMedia).length === 0) {
                                socialMedia = undefined;
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing social media accounts:', e);
                    }
                }
                
                return {
                    wikidataId: city[0],
                    name: city[1],
                    countryWikidataId: city[2],
                    countryName: countryName,
                    countryCode: countryCode,
                    population: population,
                    populationDate: populationDate,
                    coordinates: coordinates,
                    officialWebsite: city[6] || undefined,
                    socialMedia: socialMedia
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
