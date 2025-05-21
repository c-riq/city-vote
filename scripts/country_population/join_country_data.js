/**
 * This script joins the population data with the existing countries.ts file.
 * It preserves all existing entries and adds population and determination date columns.
 * 
 * To run this script:
 * 1. Make sure country_population_data.json exists
 * 2. Run: node join_country_data.js
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Setup for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to read the country population data
function readCountryPopulationData() {
  try {
    const data = fs.readFileSync(resolve(__dirname, 'country_population_data.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading country population data:', error);
    return [];
  }
}

// Function to read the original countries.ts file
function readOriginalCountriesData() {
  try {
    const data = fs.readFileSync(resolve(__dirname, '../../serverless/autocomplete/src/countries.ts'), 'utf8');
    // Extract the countries array using regex
    const countriesMatch = data.match(/\"countries\"\s*:\s*\[([\s\S]*?)\]\s*\}/);
    if (!countriesMatch) {
      console.error('Could not parse countries data from file');
      return { header: [], countries: [] };
    }
    
    // Parse the countries array
    const countriesString = `[${countriesMatch[1]}]`;
    const countriesList = eval(countriesString); // Note: Using eval is not ideal but works for this demo
    
    // Extract the header
    const headerMatch = data.match(/\"header\"\s*:\s*\[(.*?)\]/);
    const headerString = headerMatch ? headerMatch[1] : '[]';
    const header = eval(`[${headerString}]`);
    
    return {
      header,
      countries: countriesList
    };
  } catch (error) {
    console.error('Error reading original countries data:', error);
    return { header: [], countries: [] };
  }
}

// Function to join the data
function joinData() {
  const populationData = readCountryPopulationData();
  const originalData = readOriginalCountriesData();
  
  // Check if the header already includes population columns
  const hasPopulationColumns = originalData.header.includes("Population");
  
  // Create a map of Wikidata IDs to population data
  const populationMap = {};
  populationData.forEach(country => {
    if (country.wikidataId) {
      // Convert population to a number if possible
      let population = country.population;
      if (population === "N/A") {
        population = null;
      } else {
        // Remove commas and convert to number
        population = Number(population.replace(/,/g, ""));
        
        // If conversion failed, use null
        if (isNaN(population)) {
          population = null;
        }
      }
      
      populationMap[country.wikidataId] = {
        population: population,
        determinationDate: country.determinationDate === "N/A" ? null : country.determinationDate
      };
    }
  });
  
  // Create a map of country names to population data as a fallback
  const nameToPopulationMap = {};
  populationData.forEach(country => {
    if (country.country) {
      // Convert population to a number if possible
      let population = country.population;
      if (population === "N/A") {
        population = null;
      } else {
        // Remove commas and convert to number
        population = Number(population.replace(/,/g, ""));
        
        // If conversion failed, use null
        if (isNaN(population)) {
          population = null;
        }
      }
      
      nameToPopulationMap[country.country] = {
        population: population,
        determinationDate: country.determinationDate === "N/A" ? null : country.determinationDate
      };
    }
  });
  
  // If the header already includes population columns, use the original header
  // Otherwise, create a new header that includes population
  const newHeader = hasPopulationColumns 
    ? originalData.header 
    : [...originalData.header, "Population", "Determination Date"];
  
  // Join the data
  const newCountries = originalData.countries.map(country => {
    // If the country already has population data, return it as is
    if (hasPopulationColumns && country.length > 5) {
      return country;
    }
    
    const countryName = country[0];
    const wikidataId = country[4];
    
    // Try to find population data by Wikidata ID first, then by country name
    let populationInfo = null;
    if (wikidataId && populationMap[wikidataId]) {
      populationInfo = populationMap[wikidataId];
    } else if (nameToPopulationMap[countryName]) {
      populationInfo = nameToPopulationMap[countryName];
    }
    
    // Add population and determination date, or null if not found
    if (populationInfo) {
      return [...country, populationInfo.population, populationInfo.determinationDate];
    } else {
      return [...country, null, null];
    }
  });
  
  return {
    header: newHeader,
    countries: newCountries
  };
}

// Function to format the data with the same newline pattern as the original file
function formatDataWithSingleLineEntries(data) {
  const header = JSON.stringify(data.header);
  
  // Format countries array with each country on a single line
  const countriesLines = data.countries.map(country => {
    return `        ${JSON.stringify(country)}`;
  }).join(',\n');
  
  return `export const countries = {
    "header": ${header},
    "countries" : [
${countriesLines}
    ]
};`;
}

// Function to write the joined data to the original countries.ts file
function writeJoinedData(data) {
  const outputContent = formatDataWithSingleLineEntries(data);
  
  try {
    // Write the joined data to the original file
    fs.writeFileSync(
      resolve(__dirname, '../../serverless/autocomplete/src/countries.ts'), 
      outputContent
    );
    console.log('Joined data written to countries.ts');
  } catch (error) {
    console.error('Error writing joined data:', error);
  }
}

// Main function
function main() {
  console.log('Joining country population data with countries.ts...');
  const joinedData = joinData();
  writeJoinedData(joinedData);
}

// Run the script
main();
