/**
 * This script demonstrates how to use the SPARQL query to fetch country population data
 * from Wikidata based on ISO codes.
 * 
 * To run this script:
 * 1. Install Node.js if not already installed
 * 2. Install dependencies: npm run install-deps
 * 3. Run: npm start
 */

import fetch from 'node-fetch';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';

// Setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Function to execute SPARQL query against Wikidata endpoint
async function executeQuery() {
  // Read the SPARQL query from the file
  const query = fs.readFileSync(resolve(__dirname, 'country_population_query.sparql'), 'utf8');
  
  // Remove comments and format query for URL
  const formattedQuery = query
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))
    .join('\n')
    .trim();
  
  const url = 'https://query.wikidata.org/sparql';
  const fullUrl = `${url}?query=${encodeURIComponent(formattedQuery)}&format=json`;
  
  try {
    const response = await fetch(fullUrl, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'Country Population Data Script/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    return processResults(data);
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}

// Process and format the query results
function processResults(data) {
  if (!data || !data.results || !data.results.bindings) {
    console.error('Invalid data format received');
    return [];
  }
  
  return data.results.bindings.map(item => {
    return {
      country: item.countryLabel?.value || 'Unknown',
      iso2Code: item.iso2Code?.value || 'N/A',
      iso3Code: item.iso3Code?.value || 'N/A',
      wikidataId: item.wikidataId?.value || 'N/A',
      population: item.population?.value ? parseInt(item.population.value, 10).toLocaleString() : 'N/A',
      determinationDate: item.determinationDate?.value ? new Date(item.determinationDate.value).toISOString().split('T')[0] : 'N/A'
    };
  });
}

// Function to match Wikidata IDs with our local country data
function matchWithLocalData(results) {
  // Import the countries data from the local file
  const countriesPath = resolve(__dirname, '../../serverless/autocomplete/src/countries.ts');
  // Since we can't directly import .ts files in Node.js without TypeScript setup,
  // we'll parse the file content manually
  const countriesContent = fs.readFileSync(countriesPath, 'utf8');
  
  // Extract the countries array using regex
  const countriesMatch = countriesContent.match(/\"countries\"\s*:\s*\[([\s\S]*?)\]\s*\}/);
  if (!countriesMatch) {
    console.error('Could not parse countries data from file');
    return results;
  }
  
  // Parse the countries array
  const countriesString = `[${countriesMatch[1]}]`;
  const countriesList = eval(countriesString); // Note: Using eval is not ideal but works for this demo
  
  // Create a map of Wikidata IDs to country data from our local data
  const wikidataIdMap = {};
  countriesList.forEach(country => {
    if (country[4]) { // If Wikidata ID exists
      wikidataIdMap[country[4]] = {
        name: country[0],
        iso2Code: country[1],
        iso3Code: country[2]
      };
    }
  });
  
  // Enhance results with local data matching and fill in missing ISO codes
  return results.map(result => {
    const localCountryData = wikidataIdMap[result.wikidataId];
    
    // If we have local data for this Wikidata ID, use it to fill in missing ISO codes
    if (localCountryData) {
      // Fill in missing ISO codes from local data
      if (result.iso2Code === 'N/A' && localCountryData.iso2Code) {
        result.iso2Code = localCountryData.iso2Code;
      }
      if (result.iso3Code === 'N/A' && localCountryData.iso3Code) {
        result.iso3Code = localCountryData.iso3Code;
      }
      
      return {
        ...result,
        matchesLocalData: 'Yes'
      };
    }
    
    return {
      ...result,
      matchesLocalData: 'No'
    };
  });
}

// Main function to run the script
async function main() {
  console.log('Fetching country population data from Wikidata...');
  const results = await executeQuery();
  
  if (!results) {
    console.log('Failed to fetch data. Please check your internet connection and try again.');
    return;
  }
  
  console.log(`Retrieved data for ${results.length} countries.`);
  
  // Match with local data
  const matchedResults = matchWithLocalData(results);
  
  // Save results to a JSON file
  fs.writeFileSync(resolve(__dirname, 'country_population_data.json'), JSON.stringify(matchedResults, null, 2));
  console.log('Results saved to scripts/country_population/country_population_data.json');
  
  // Display a sample of the results
  console.log('\nSample of results (first 5 countries):');
  console.table(matchedResults.slice(0, 5));
}

// Run the script
main().catch(error => {
  console.error('An error occurred:', error);
});
