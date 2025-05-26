import * as fs from 'fs';
import * as path from 'path';
import { normalizeCharacter } from './character-map';

// Function to check if a string contains non-ASCII characters
function containsNonASCII(str: string): boolean {
  return /[^\x00-\x7F]/.test(str);
}

// Function to normalize a string by replacing all special characters
function normalizeString(str: string): string {
  // Then normalize special characters
  return str.split('').map(char => normalizeCharacter(char)).join('');
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

// Function to split CSV by first letter of city name
async function splitCSVByFirstLetter() {
  try {
    // Read the deduplicated CSV file
    const csvPath = path.join(__dirname, 'city-data-deduplicated.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf8');
    
    // Split the content into lines
    const lines = fileContent.split('\n');
    
    // Get the header line (first line)
    let headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    
    // Find the index of the city name column
    const cityNameIndex = headers.indexOf('cityLabelEnglish');
    if (cityNameIndex === -1) {
      throw new Error('City name column not found in CSV');
    }
    
    // Find the index of the socialMedia column
    const socialMediaIndex = headers.indexOf('socialMedia');
    
    // Add the ascii column to the header if it doesn't exist
    if (headers.indexOf('ascii') === -1) {
      // If socialMedia column exists, insert ascii before it to keep socialMedia last
      if (socialMediaIndex !== -1) {
        headers.splice(socialMediaIndex, 0, 'ascii');
      } else {
        // If no socialMedia column, just append ascii
        headers.push('ascii');
      }
      headerLine = headers.join(',');
      lines[0] = headerLine;
    }
    
    // Create a directory for the split files if it doesn't exist
    const outputDir = path.join(__dirname, 'split_by_letter');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Create a map to store lines by first letter
    const linesByLetter: { [key: string]: string[] } = {};
    
    // Add header to all files
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      linesByLetter[letter] = [headerLine];
    }
    
    // Add a special category for non-alphabetic characters
    linesByLetter['#'] = [headerLine];
    
    // Process each line (skip header)
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const cityData = parseCSVLine(lines[i]);
      if (cityData.length <= cityNameIndex) continue; // Skip malformed lines
      
      const cityName = cityData[cityNameIndex];
      if (!cityName) continue; // Skip if city name is empty
      
      // Remove city prefixes and add ASCII normalized version for all city names
      const asciiName = normalizeString(cityName);
      
      // Only add the ASCII version if it's different from the original name
      const asciiValue = (containsNonASCII(cityName) && asciiName !== cityName) ? asciiName : '';
      
      // Check if this row has a socialMedia value
      const hasSocialMedia = cityData.length > socialMediaIndex && socialMediaIndex !== -1;
      
      // If there's a socialMedia column in the header
      if (socialMediaIndex !== -1) {
        // If the row already has a value in the socialMedia position
        if (hasSocialMedia) {
          // Store the socialMedia value
          const socialMediaValue = cityData[socialMediaIndex];
          
          // Remove the socialMedia value
          cityData.splice(socialMediaIndex, 1);
          
          // Add the ascii value
          cityData.push(asciiValue);
          
          // Add the socialMedia value back at the end
          cityData.push(socialMediaValue);
        } else {
          // If the row doesn't have enough columns to reach socialMedia
          // Add empty values until we reach one before socialMedia
          while (cityData.length < socialMediaIndex) {
            cityData.push('');
          }
          
          // Add the ascii value
          cityData.push(asciiValue);
          
          // Add an empty socialMedia value
          cityData.push('');
        }
      } else {
        // If no socialMedia column in header, just append ascii
        cityData.push(asciiValue);
      }
      
      // Update the line with the new column
      lines[i] = cityData.join(',');
      
    // Get the first letter and convert to uppercase
    let firstLetter = cityName.charAt(0).toUpperCase();
    
    // Normalize the first letter if it's a special character
    firstLetter = normalizeCharacter(firstLetter);
    
    // Check if the first letter is alphabetic
    if (/[A-Z]/.test(firstLetter) && linesByLetter[firstLetter]) {
      // Add to the appropriate letter array
      linesByLetter[firstLetter].push(lines[i]);
    } else {
      // Add to the non-alphabetic category
      linesByLetter['#'].push(lines[i]);
    }
    }
    
    // Write each letter's lines to a separate file
    for (const letter in linesByLetter) {
      if (linesByLetter[letter].length > 1) { // Only create file if there are entries (more than just the header)
        const outputPath = path.join(outputDir, `${letter}.csv`);
        fs.writeFileSync(outputPath, linesByLetter[letter].join('\n'));
        console.log(`Created ${outputPath} with ${linesByLetter[letter].length - 1} entries`);
      }
    }
    
    console.log('CSV split by first letter completed successfully!');
  } catch (error) {
    console.error('Error splitting CSV by first letter:', error);
  }
}

// Run the function
splitCSVByFirstLetter();
