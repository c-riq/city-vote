import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AutocompleteRequest, AutocompleteResponse } from './types';
import { countries } from './countries';
import * as fs from 'fs';
import * as path from 'path';

// CSV parsing and search functions
interface CityData {
  wikidataId: string;
  name: string;
  countryWikidataId: string;
  countryName: string;
  countryCode: string;
  population?: number;
  populationDate?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  officialWebsite?: string;
  socialMedia?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
  };
}

// Cache for CSV data and country maps
let csvLinesCache: string[] | null = null;
let headersCache: string[] | null = null;
let cityNameIndexCache: number | null = null;
let countryNameMapCache: Map<string, string> | null = null;
let countryCodeMapCache: Map<string, string> | null = null;

// Function to parse a CSV line, handling quoted fields with embedded commas
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Handle escaped quotes (two double quotes in a row)
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current);
  
  return result;
}

// Function to parse JSON string safely
function safeParseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return null;
  }
}

// Initialize the cache for CSV data and country maps
async function initializeCache(): Promise<void> {
  if (csvLinesCache !== null) {
    return; // Cache already initialized
  }
  
  // Read and parse the CSV file
  const csvPath = path.join(__dirname, 'city-data.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf8');
  csvLinesCache = fileContent.split('\n');
  
  // Parse the header line
  const headerLine = csvLinesCache[0];
  headersCache = parseCSVLine(headerLine);
  
  // Find the index of the city name column
  cityNameIndexCache = headersCache.indexOf('cityLabelEnglish');
  if (cityNameIndexCache === -1) {
    throw new Error('City name column not found in CSV');
  }
  
  // Create maps for country wikidata IDs to country names and ISO codes
  countryNameMapCache = new Map<string, string>();
  countryCodeMapCache = new Map<string, string>();
  countries.countries.forEach(country => {
    if (country[4]) { // Check if wikidata id exists
      countryNameMapCache.set(country[4], country[0]);
      countryCodeMapCache.set(country[4], country[1]); // Alpha-2 code
    }
  });
}

// Optimized search function for CSV data
async function searchCities(query: string, limit: number = 10): Promise<CityData[]> {
  // Initialize cache if not already done
  await initializeCache();
  
  // Normalize the query for case-insensitive search
  const normalizedQuery = query.toLowerCase();
  
  // Filter cities based on the query
  const matchingCities: CityData[] = [];
  
  // Use cached values
  const lines = csvLinesCache!;
  const cityNameIndex = cityNameIndexCache!;
  const countryNameMap = countryNameMapCache!;
  const countryCodeMap = countryCodeMapCache!;
  
  // Start from line 1 (skip header)
  for (let i = 1; i < lines.length && matchingCities.length < limit; i++) {
    if (!lines[i].trim()) continue; // Skip empty lines
    
    const cityData = parseCSVLine(lines[i]);
    if (cityData.length <= cityNameIndex) continue; // Skip malformed lines
    
    const cityName = cityData[cityNameIndex];
    
    // Check if the city name includes the query
    if (cityName.toLowerCase().includes(normalizedQuery)) {
      const wikidataId = cityData[0];
      const countryWikidataId = cityData[2];
      const countryName = countryNameMap.get(countryWikidataId) || '';
      const countryCode = countryCodeMap.get(countryWikidataId) || '';
      
      // Parse population as number if it exists
      let population: number | undefined = undefined;
      if (cityData[3] && cityData[3] !== '') {
        const parsedPopulation = Number(cityData[3]);
        if (!isNaN(parsedPopulation)) {
          population = parsedPopulation;
        }
      }
      
      // Get population date if it exists
      const populationDate = cityData[4] || undefined;
      
      // Parse coordinates if they exist
      let coordinates: { latitude: number; longitude: number } | undefined = undefined;
      if (cityData[5] && cityData[5] !== '') {
        const coordObj = safeParseJSON(cityData[5]);
        if (coordObj && typeof coordObj === 'object' && 
            'latitude' in coordObj && 'longitude' in coordObj) {
          coordinates = {
            latitude: Number(coordObj.latitude),
            longitude: Number(coordObj.longitude)
          };
        }
      }
      
      // Get official website if it exists
      const officialWebsite = cityData[6] || undefined;
      
      // Parse social media accounts if they exist
      let socialMedia: { 
        twitter?: string; 
        facebook?: string; 
        instagram?: string; 
        youtube?: string; 
        linkedin?: string; 
      } | undefined = undefined;
      
      if (cityData[7] && cityData[7] !== '') {
        const socialObj = safeParseJSON(cityData[7]);
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
      }
      
      matchingCities.push({
        wikidataId,
        name: cityName,
        countryWikidataId,
        countryName,
        countryCode,
        population,
        populationDate,
        coordinates,
        officialWebsite,
        socialMedia
      });
    }
  }
  
  return matchingCities;
}

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
    // Use the efficient CSV search function
    const filteredCities = await searchCities(query, limit);

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
