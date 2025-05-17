#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Directories and files
const inputDir = path.join(__dirname, './data/cities');
const outputFile = path.join(__dirname, '../../serverless/autocomplete/src/city-data.csv');

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
  let allCities = [];
  let header = ["cityWikidataId", "cityLabelEnglish", "countryWikidataId", "population", "populationDate", "latitude", "longitude", "officialWebsite", "socialMedia"];
  
  for (const file of files) {
    const data = readJsonLinesFile(file);
    if (data && data.cities && Array.isArray(data.cities)) {
      console.log(`Processing ${file}: Found ${data.cities.length} cities`);
      
      // Transform the data to match the target format
      const transformedCities = data.cities.map(city => {
        // Round coordinates to 2 decimal places if they exist
        let latitude = city[7];
        let longitude = city[8];
        if (latitude !== null && longitude !== null) {
          latitude = roundToDecimalPlaces(latitude, 2);
          longitude = roundToDecimalPlaces(longitude, 2);
        }
        
        // Assuming the order in the source is:
        // [cityWikidataId, cityLabelEnglish, countryWikidataId, ancestorType, classLabel, population, populationDate, latitude, longitude, officialWebsite, socialMedia]
        return [
          city[0],                // cityWikidataId
          city[1],                // cityLabelEnglish
          city[2],                // countryWikidataId
          city[5],                // population
          city[6],                // populationDate
          latitude,               // latitude
          longitude,              // longitude
          city[9],                // officialWebsite
          city[10]                // socialMedia
        ]; // Skip ancestorType (index 3) and classLabel (index 4)
      });
      
      allCities = allCities.concat(transformedCities);
    } else {
      console.warn(`Warning: No valid data found in ${file}`);
    }
  }
  
  return { header, cities: allCities };
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
