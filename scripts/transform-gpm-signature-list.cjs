const fs = require('fs');
const path = require('path');

const basePath = path.join(__dirname, '../public-data/city-networks/global-parliament-of-mayors/joint-statements/global-declaration-of-mayors-for-democracy/');

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',');
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {
        city_name: values[0],
        country: values[1],
        wikidata_id: values[2],
        mayor_name: values[3],
        mayor_title: values[4]
      };
      rows.push(row);
    }
  }

  return rows;
}

function generateSignatures() {
  try {
    // Read the CSV file
    const csvPath = path.join(basePath, 'signatures.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV data
    const csvRows = parseCSV(csvContent);
    
    // Convert to signature format
    const signatures = csvRows.map(row => ({
      vote: "Sign",
      author: {
        title: row.mayor_title,
        name: row.mayor_name,
        actingCapacity: "individual"
      },
      organisationNameFallback: row.city_name,
      associatedCityId: row.wikidata_id,
      externalVerificationSource: ""
    }));

    // Write to JSON file
    const jsonPath = path.join(basePath, 'signatures.json');
    fs.writeFileSync(jsonPath, JSON.stringify(signatures, null, 2), 'utf-8');
    
    console.log(`✅ Generated signatures.json with ${signatures.length} entries`);
    console.log(`📍 File saved to: ${jsonPath}`);
    
    // Show some statistics
    const foundCities = signatures.filter(s => s.associatedCityId !== 'NOT_FOUND').length;
    const notFoundCities = signatures.length - foundCities;
    
    console.log(`📊 Statistics:`);
    console.log(`   - Cities with wikidata IDs: ${foundCities}`);
    console.log(`   - Cities not found: ${notFoundCities}`);
    console.log(`   - Success rate: ${((foundCities / signatures.length) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error generating signatures.json:', error);
    process.exit(1);
  }
}

// Run the script
generateSignatures();