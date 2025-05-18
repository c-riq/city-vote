import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { AutocompleteRequest } from './types';
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
  latitude?: number;
  longitude?: number;
  officialWebsite?: string;
  socialMedia?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
  };
  supersedes_duplicates?: string[];
  superseded_by?: string;
}

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

// Function to get the first 2 digits of a QID
function getQidPrefix(qid: string): string {
  // Remove the 'Q' prefix
  const numericPart = qid.substring(1);
  
  // Pad with leading zeros if needed
  const paddedNumeric = numericPart.padStart(2, '0');
  
  // Get the first 2 digits
  return paddedNumeric.substring(0, 2);
}

// Function to find a city by its Wikidata QID
async function findCityByQid(qid: string): Promise<CityData | null> {
  // Determine which split file to use based on QID prefix
  const qidPrefix = getQidPrefix(qid);
  const splitCsvPath = path.join(__dirname, 'split_by_qid', `Q${qidPrefix}.csv`);
  
  // Check if the split file exists, otherwise return null (no fallback to original file)
  if (!fs.existsSync(splitCsvPath)) {
    console.log(`Split file for QID prefix ${qidPrefix} not found`);
    return null;
  }
  
  const csvPath = splitCsvPath;
  
  // Read and parse the CSV file
  const fileContent = fs.readFileSync(csvPath, 'utf8');
  
  // Split the content into lines
  const lines = fileContent.split('\n');
  
  // Get the header line (first line)
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  // Find the index of the city wikidata ID column
  const cityWikidataIdIndex = headers.indexOf('cityWikidataId');
  if (cityWikidataIdIndex === -1) {
    throw new Error('City wikidata ID column not found in CSV');
  }
  
  // Find the index of the superseded_by column
  const supersededByIndex = headers.indexOf('superseded_by');
  const supersededDuplicatesIndex = headers.indexOf('supersedes_duplicates');
  
  // Create maps for country wikidata IDs to country names and ISO codes
  const countryNameMap = new Map<string, string>();
  const countryCodeMap = new Map<string, string>();
  countries.countries.forEach(country => {
    if (country[4]) { // Check if wikidata id exists
      countryNameMap.set(country[4], country[0]);
      countryCodeMap.set(country[4], country[1]); // Alpha-2 code
    }
  });
  
  // Start from line 1 (skip header)
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // Skip empty lines
    
    const cityData = parseCSVLine(lines[i]);
    if (cityData.length <= cityWikidataIdIndex) continue; // Skip malformed lines
    
    const cityWikidataId = cityData[0];
    
    // Check if the city wikidata ID matches the query
    if (cityWikidataId === qid) {
      // Check if this city is superseded by another city
      if (supersededByIndex !== -1 && cityData[supersededByIndex] && cityData[supersededByIndex] !== '') {
        // If this city is superseded, recursively find the superseding city
        console.log(`City ${qid} is superseded by ${cityData[supersededByIndex]}, redirecting...`);
        return findCityByQid(cityData[supersededByIndex]);
      }
      
      const cityName = cityData[1];
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
      
      // Parse latitude and longitude if they exist
      let latitude: number | undefined = undefined;
      let longitude: number | undefined = undefined;
      
      // Parse latitude (index 5)
      if (cityData[5] && cityData[5] !== '') {
        const parsedLat = Number(cityData[5]);
        if (!isNaN(parsedLat)) {
          latitude = parsedLat;
        }
      }
      
      // Parse longitude (index 6)
      if (cityData[6] && cityData[6] !== '') {
        const parsedLong = Number(cityData[6]);
        if (!isNaN(parsedLong)) {
          longitude = parsedLong;
        }
      }
      
      // Get official website if it exists
      const officialWebsite = cityData[7] || undefined;
      
      // Parse social media accounts if they exist
      let socialMedia: {
        twitter?: string;
        facebook?: string;
        instagram?: string;
        youtube?: string;
        linkedin?: string;
      } | undefined = undefined;
      
      if (cityData[8] && cityData[8] !== '') {
        const socialObj = safeParseJSON(cityData[8]);
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
      
      // Parse supersedes_duplicates if it exists
      let supersedes_duplicates: string[] | undefined = undefined;
      if (supersededDuplicatesIndex !== -1 && cityData[supersededDuplicatesIndex] && cityData[supersededDuplicatesIndex] !== '') {
        supersedes_duplicates = cityData[supersededDuplicatesIndex].split('|');
      }
      
      return {
        wikidataId: cityWikidataId,
        name: cityName,
        countryWikidataId,
        countryName,
        countryCode,
        population,
        populationDate,
        latitude,
        longitude,
        officialWebsite,
        socialMedia,
        supersedes_duplicates
      };
    }
  }
  
  return null; // City not found
}

// Efficient search function for CSV data
async function searchCities(query: string, limit: number = 10): Promise<CityData[]> {
  // Normalize the query for case-insensitive search
  const normalizedQuery = query.toLowerCase();
  
  // Determine which split file to use based on first letter of query
  const firstLetter = normalizedQuery.charAt(0).toUpperCase();
  let csvPath;
  
  if (/[A-Z]/.test(firstLetter)) {
    // Use the appropriate letter file
    csvPath = path.join(__dirname, 'split_by_letter', `${firstLetter}.csv`);
  } else {
    // For non-alphabetic characters, use the # file
    csvPath = path.join(__dirname, 'split_by_letter', '#.csv');
  }
  
  // Check if the split file exists, otherwise return empty results (no fallback to original file)
  if (!fs.existsSync(csvPath)) {
    console.log(`Split file for letter ${firstLetter} not found`);
    return [];
  }
  
  // Read and parse the CSV file
  const fileContent = fs.readFileSync(csvPath, 'utf8');
  
  // Split the content into lines
  const lines = fileContent.split('\n');
  
  // Get the header line (first line)
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  // Find the index of the city name column
  const cityNameIndex = headers.indexOf('cityLabelEnglish');
  if (cityNameIndex === -1) {
    throw new Error('City name column not found in CSV');
  }
  
  // Find the index of the superseded_by column
  const supersededByIndex = headers.indexOf('superseded_by');
  const supersededDuplicatesIndex = headers.indexOf('supersedes_duplicates');
  
  // We already normalized the query at the beginning of the function
  
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
  const matchingCities: CityData[] = [];
  
  // Start from line 1 (skip header)
  for (let i = 1; i < lines.length && matchingCities.length < limit; i++) {
    if (!lines[i].trim()) continue; // Skip empty lines
    
    const cityData = parseCSVLine(lines[i]);
    if (cityData.length <= cityNameIndex) continue; // Skip malformed lines
    
    // Skip cities that are superseded by others
    if (supersededByIndex !== -1 && cityData[supersededByIndex] && cityData[supersededByIndex] !== '') {
      continue;
    }
    
    const cityName = cityData[cityNameIndex];
    
    // Check if the city name starts with the query (prefix match only)
    if (cityName.toLowerCase().startsWith(normalizedQuery)) {
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
      
      // Parse latitude and longitude if they exist
      let latitude: number | undefined = undefined;
      let longitude: number | undefined = undefined;
      
      // Parse latitude (index 5)
      if (cityData[5] && cityData[5] !== '') {
        const parsedLat = Number(cityData[5]);
        if (!isNaN(parsedLat)) {
          latitude = parsedLat;
        }
      }
      
      // Parse longitude (index 6)
      if (cityData[6] && cityData[6] !== '') {
        const parsedLong = Number(cityData[6]);
        if (!isNaN(parsedLong)) {
          longitude = parsedLong;
        }
      }
      
      // Get official website if it exists
      const officialWebsite = cityData[7] || undefined;
      
      // Parse social media accounts if they exist
      let socialMedia: {
        twitter?: string;
        facebook?: string;
        instagram?: string;
        youtube?: string;
        linkedin?: string;
      } | undefined = undefined;
      
      if (cityData[8] && cityData[8] !== '') {
        const socialObj = safeParseJSON(cityData[8]);
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
      
      // Parse supersedes_duplicates if it exists
      let supersedes_duplicates: string[] | undefined = undefined;
      if (supersededDuplicatesIndex !== -1 && cityData[supersededDuplicatesIndex] && cityData[supersededDuplicatesIndex] !== '') {
        supersedes_duplicates = cityData[supersededDuplicatesIndex].split('|');
      }
      
      matchingCities.push({
        wikidataId,
        name: cityName,
        countryWikidataId,
        countryName,
        countryCode,
        population,
        populationDate,
        latitude,
        longitude,
        officialWebsite,
        socialMedia,
        supersedes_duplicates
      });
    }
  }
  
  // Sort results by population in descending order
  // Cities with no population will be at the end
  return matchingCities.sort((a, b) => {
    // If both have population, sort by population (descending)
    if (a.population && b.population) {
      return b.population - a.population;
    }
    // If only a has population, a comes first
    if (a.population) {
      return -1;
    }
    // If only b has population, b comes first
    if (b.population) {
      return 1;
    }
    // If neither has population, maintain original order
    return 0;
  });
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

// Handler for getByQid action
const handleGetByQid = async (qid: string): Promise<APIGatewayProxyResult> => {
  if (!qid) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Missing required parameter: qid'
      }, null, 2)
    };
  }

  try {
    // Find the city by QID
    const city = await findCityByQid(qid);
    
    if (!city) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `City with QID ${qid} not found`
        }, null, 2)
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: [city]
      }, null, 2)
    };
  } catch (error) {
    console.error('Error during QID lookup:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'QID lookup error',
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

    const { action, query, qid, limit } = JSON.parse(event.body) as AutocompleteRequest;
    
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
    } else if (action === 'getByQid') {
      return await handleGetByQid(qid || '');
    } else {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Invalid action: ${action}. Supported actions are: autocomplete, getByQid`
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
