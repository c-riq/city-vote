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

// Function to get the first 2 digits of a QID
function getQidPrefix(qid: string): string {
  // Remove the 'Q' prefix
  const numericPart = qid.substring(1);
  
  // Pad with leading zeros if needed
  const paddedNumeric = numericPart.padStart(2, '0');
  
  // Get the first 2 digits
  return paddedNumeric.substring(0, 2);
}

// Function to split CSV by first 2 digits of QID
async function splitCSVByQidPrefix() {
  try {
    // Read the original CSV file
    const csvPath = path.join(__dirname, 'city-data.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf8');
    
    // Split the content into lines
    const lines = fileContent.split('\n');
    
    // Get the header line (first line)
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine);
    
    // Find the index of the QID column
    const qidIndex = headers.indexOf('cityWikidataId');
    if (qidIndex === -1) {
      throw new Error('City wikidata ID column not found in CSV');
    }
    
    // Create a directory for the split files if it doesn't exist
    const outputDir = path.join(__dirname, 'split_by_qid');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    // Create a map to store lines by QID prefix
    const linesByQidPrefix: { [key: string]: string[] } = {};
    
    // Process each line (skip header)
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue; // Skip empty lines
      
      const cityData = parseCSVLine(lines[i]);
      if (cityData.length <= qidIndex) continue; // Skip malformed lines
      
      const qid = cityData[qidIndex];
      if (!qid) continue; // Skip if QID is empty
      
      // Get the QID prefix (first 2 digits)
      const qidPrefix = getQidPrefix(qid);
      
      // Initialize the array for this prefix if it doesn't exist
      if (!linesByQidPrefix[qidPrefix]) {
        linesByQidPrefix[qidPrefix] = [headerLine];
      }
      
      // Add the line to the appropriate prefix array
      linesByQidPrefix[qidPrefix].push(lines[i]);
    }
    
    // Write each prefix's lines to a separate file
    for (const prefix in linesByQidPrefix) {
      if (linesByQidPrefix[prefix].length > 1) { // Only create file if there are entries (more than just the header)
        const outputPath = path.join(outputDir, `Q${prefix}.csv`);
        fs.writeFileSync(outputPath, linesByQidPrefix[prefix].join('\n'));
        console.log(`Created ${outputPath} with ${linesByQidPrefix[prefix].length - 1} entries`);
      }
    }
    
    console.log('CSV split by QID prefix completed successfully!');
  } catch (error) {
    console.error('Error splitting CSV by QID prefix:', error);
  }
}

// Run the function
splitCSVByQidPrefix();