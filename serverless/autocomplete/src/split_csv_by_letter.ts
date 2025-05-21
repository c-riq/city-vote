import * as fs from 'fs';
import * as path from 'path';

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
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    
    // Find the index of the city name column
    const cityNameIndex = headers.indexOf('cityLabelEnglish');
    if (cityNameIndex === -1) {
      throw new Error('City name column not found in CSV');
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
      
      // Get the first letter and convert to uppercase
      const firstLetter = cityName.charAt(0).toUpperCase();
      
      // Check if the first letter is alphabetic
      if (/[A-Z]/.test(firstLetter)) {
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