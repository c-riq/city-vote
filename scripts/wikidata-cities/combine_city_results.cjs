#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Directories and files
const inputDir = path.join(__dirname, './data/cities');
const outputFile = path.join(__dirname, '../../serverless/autocomplete/src/city-data.csv');
const provinceLookupFile = path.join(__dirname, './data/cities/province_lookup.json');

// Function to read the province lookup file
function readProvinceLookup() {
  try {
    if (fs.existsSync(provinceLookupFile)) {
      const data = fs.readFileSync(provinceLookupFile, 'utf8');
      return JSON.parse(data);
    } else {
      console.warn(`Warning: Province lookup file not found at ${provinceLookupFile}`);
      return {};
    }
  } catch (error) {
    console.error(`Error reading province lookup file:`, error);
    return {};
  }
}

// Function to read and parse a JSON Lines file
function readJsonLinesFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.trim().split('\n');
    
    // First line is the header
    const header = JSON.parse(lines[0]);
    
    // Rest of the lines are city data
    const cities = lines.slice(1).map(line => JSON.parse(line));
    
    return { header, cities };
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Function to round a number to a specific number of decimal places
function roundToDecimalPlaces(num, decimalPlaces) {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(num * factor) / factor;
}

// Function to find all result files from the Python script
function findResultFiles() {
  try {
    // Create the directory if it doesn't exist
    if (!fs.existsSync(inputDir)) {
      console.log(`Creating directory: ${inputDir}`);
      fs.mkdirSync(inputDir, { recursive: true });
      return [];
    }
    
    const files = fs.readdirSync(inputDir);
    // Filter for files that match the pattern cities_process_*_final.json
    return files
      .filter(file => file.match(/cities_process_\d+_final\.json/))
      .map(file => path.join(inputDir, file));
  } catch (error) {
    console.error('Error finding result files:', error);
    return [];
  }
}

// Function to combine city data from multiple files
function combineData(files) {
  // Read the province lookup data
  const provinceLookup = readProvinceLookup();
  console.log(`Loaded province lookup with ${Object.keys(provinceLookup).length} provinces`);
  
  let allCities = [];
  let outputHeader = ["cityWikidataId", "cityLabelEnglish", "countryWikidataId", "stateProvinceWikidataId", "stateProvinceLabel", "population", "populationDate", "latitude", "longitude", "officialWebsite", "socialMedia"];
  
  for (const file of files) {
    const data = readJsonLinesFile(file);
    if (data && data.cities && Array.isArray(data.cities) && data.header && Array.isArray(data.header)) {
      console.log(`Processing ${file}: Found ${data.cities.length} cities`);
      
      // Get indices from the header
      const cityWikidataIdIndex = data.header.indexOf("cityWikidataId");
      const cityLabelEnglishIndex = data.header.indexOf("cityLabelEnglish");
      const countryWikidataIdIndex = data.header.indexOf("countryWikidataId");
      const stateProvinceWikidataIdIndex = data.header.indexOf("stateProvinceWikidataId");
      const populationIndex = data.header.indexOf("population");
      const populationDateIndex = data.header.indexOf("populationDate");
      const latitudeIndex = data.header.indexOf("latitude");
      const longitudeIndex = data.header.indexOf("longitude");
      const officialWebsiteIndex = data.header.indexOf("officialWebsite");
      const socialMediaIndex = data.header.indexOf("socialMedia");
      
      // Check if all required fields are present
      if (cityWikidataIdIndex === -1 || cityLabelEnglishIndex === -1 || countryWikidataIdIndex === -1) {
        console.warn(`Warning: Required fields missing in ${file}, skipping`);
        continue;
      }
      
      // Transform the data to match the target format
      const transformedCities = data.cities.map(city => {
        // Round coordinates to 2 decimal places if they exist
        let latitude = latitudeIndex !== -1 ? city[latitudeIndex] : null;
        let longitude = longitudeIndex !== -1 ? city[longitudeIndex] : null;
        
        if (latitude !== null && longitude !== null) {
          latitude = roundToDecimalPlaces(latitude, 2);
          longitude = roundToDecimalPlaces(longitude, 2);
        }
        
        // Get the state/province ID and look up its label
        const stateProvinceId = stateProvinceWikidataIdIndex !== -1 ? city[stateProvinceWikidataIdIndex] : null;
        const stateProvinceLabel = stateProvinceId && provinceLookup[stateProvinceId] ? 
                                  provinceLookup[stateProvinceId].name : null;
        
        return [
          cityWikidataIdIndex !== -1 ? city[cityWikidataIdIndex] : null,
          cityLabelEnglishIndex !== -1 ? city[cityLabelEnglishIndex] : null,
          countryWikidataIdIndex !== -1 ? city[countryWikidataIdIndex] : null,
          stateProvinceId,
          stateProvinceLabel,
          populationIndex !== -1 ? city[populationIndex] : null,
          populationDateIndex !== -1 ? city[populationDateIndex] : null,
          latitude,
          longitude,
          officialWebsiteIndex !== -1 ? city[officialWebsiteIndex] : null,
          socialMediaIndex !== -1 ? city[socialMediaIndex] : null
        ];
      });
      
      allCities = allCities.concat(transformedCities);
    } else {
      console.warn(`Warning: No valid data found in ${file}`);
    }
  }
  
  return { header: outputHeader, cities: allCities };
}

// Function to escape CSV values properly
function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Convert objects to JSON strings
  if (typeof value === 'object') {
    value = JSON.stringify(value);
  }
  
  // Convert to string if it's not already
  value = String(value);
  
  // If the value contains commas, quotes, or newlines, wrap it in quotes and escape any quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  
  return value;
}

// Function to write the combined data to a CSV file
function writeCsvFile(data) {
  try {
    // Create the CSV header row
    const headerRow = data.header.join(',');
    
    // Create CSV rows for each city
    const cityRows = data.cities.map(city => 
      city.map(value => escapeCSV(value)).join(',')
    );
    
    // Combine header and city rows
    const csvContent = [headerRow, ...cityRows].join('\n');
    
    fs.writeFileSync(outputFile, csvContent);
    console.log(`Successfully wrote ${data.cities.length} cities to ${outputFile}`);
    return true;
  } catch (error) {
    console.error('Error writing CSV file:', error);
    return false;
  }
}

// Main function
function main() {
  console.log('Starting to combine city results...');
  
  // Find all result files
  const resultFiles = findResultFiles();
  console.log(`Found ${resultFiles.length} result files`);
  
  if (resultFiles.length === 0) {
    console.error('No result files found. Make sure the Python script has been run.');
    process.exit(1);
  }
  
  // Combine data from all files
  const combinedData = combineData(resultFiles);
  console.log(`Combined data: ${combinedData.cities.length} cities total`);
  
  // Write the combined data to the CSV file
  const success = writeCsvFile(combinedData);
  
  if (success) {
    console.log('City data combination completed successfully!');
  } else {
    console.error('Failed to write combined city data.');
    process.exit(1);
  }
}

// Run the main function
main();
