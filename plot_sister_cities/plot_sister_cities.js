#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const CITY_DATA_PATH = path.join(__dirname, '../serverless/autocomplete/src/city-data.csv');
const OUTPUT_HTML = path.join(__dirname, 'sister_cities_map.html');
const OUTPUT_JSON = path.join(__dirname, 'sister_cities_data.json');

/**
 * Parse CSV data into city objects
 */
function parseCityData(csvContent) {
  const lines = csvContent.trim().split('\n');
  const header = lines[0].split(',');
  
  // Find column indices
  const cityIdIndex = header.indexOf('cityWikidataId');
  const cityNameIndex = header.indexOf('cityLabelEnglish');
  const countryIdIndex = header.indexOf('countryWikidataId');
  const latIndex = header.indexOf('latitude');
  const lonIndex = header.indexOf('longitude');
  const populationIndex = header.indexOf('population');
  
  console.log(`Found columns: cityId=${cityIdIndex}, name=${cityNameIndex}, country=${countryIdIndex}, lat=${latIndex}, lon=${lonIndex}, pop=${populationIndex}`);
  
  const cities = {};
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    // Simple CSV parsing (handles basic cases)
    const values = parseCSVLine(line);
    
    if (values.length <= Math.max(cityIdIndex, cityNameIndex, countryIdIndex, latIndex, lonIndex)) {
      continue;
    }
    
    const cityId = values[cityIdIndex];
    const cityName = values[cityNameIndex];
    const countryId = values[countryIdIndex];
    const lat = parseFloat(values[latIndex]);
    const lon = parseFloat(values[lonIndex]);
    const population = values[populationIndex] ? parseInt(values[populationIndex]) : null;
    
    if (cityId && cityName && !isNaN(lat) && !isNaN(lon)) {
      cities[cityId] = {
        id: cityId,
        name: cityName,
        country: countryId,
        latitude: lat,
        longitude: lon,
        population: population,
        sisterCities: []
      };
    }
  }
  
  console.log(`Parsed ${Object.keys(cities).length} cities with coordinates`);
  return cities;
}

/**
 * Simple CSV line parser that handles quoted fields
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  values.push(current.trim());
  return values;
}

/**
 * Load sister cities data from the original wikidata extraction
 */
function loadSisterCitiesFromWikidata() {
  const sisterCitiesDir = path.join(__dirname, '../scripts/wikidata-cities/data/cities');
  const sisterCitiesMap = new Map();
  
  if (!fs.existsSync(sisterCitiesDir)) {
    console.warn(`Sister cities directory not found: ${sisterCitiesDir}`);
    return sisterCitiesMap;
  }
  
  try {
    const files = fs.readdirSync(sisterCitiesDir);
    const resultFiles = files.filter(file => file.match(/cities_process_\d+_final\.json/));
    
    console.log(`Found ${resultFiles.length} wikidata result files`);
    
    for (const file of resultFiles) {
      const filePath = path.join(sisterCitiesDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n');
        
        if (lines.length < 2) continue;
        
        // First line is header, rest are city data
        const header = JSON.parse(lines[0]);
        const cities = lines.slice(1).map(line => JSON.parse(line));
        
        // Find the indices for the data we need
        const cityIdIndex = header.indexOf('cityWikidataId');
        const sisterCitiesIndex = header.indexOf('sisterCities');
        
        console.log(`Processing ${file}: ${cities.length} cities (cityId=${cityIdIndex}, sisterCities=${sisterCitiesIndex})`);
        
        for (const cityArray of cities) {
          const cityId = cityArray[cityIdIndex];
          const sisterCities = cityArray[sisterCitiesIndex];
          
          if (cityId && sisterCities && Array.isArray(sisterCities) && sisterCities.length > 0) {
            sisterCitiesMap.set(cityId, sisterCities);
          }
        }
      } catch (error) {
        console.warn(`Error processing file ${file}:`, error.message);
      }
    }
  } catch (error) {
    console.warn(`Error reading sister cities directory:`, error.message);
  }
  
  console.log(`Loaded sister cities data for ${sisterCitiesMap.size} cities`);
  return sisterCitiesMap;
}

/**
 * Build sister cities network
 */
function buildSisterCitiesNetwork(cities, sisterCitiesMap) {
  const connections = [];
  const citiesWithSisters = new Set();
  
  for (const [cityId, sisterCityIds] of sisterCitiesMap) {
    const city = cities[cityId];
    if (!city) continue;
    
    for (const sisterCityId of sisterCityIds) {
      const sisterCity = cities[sisterCityId];
      if (!sisterCity) continue;
      
      // Add bidirectional connection (but avoid duplicates)
      const connectionKey = [cityId, sisterCityId].sort().join('-');
      if (!connections.find(c => c.key === connectionKey)) {
        connections.push({
          key: connectionKey,
          from: city,
          to: sisterCity,
          distance: calculateDistance(city.latitude, city.longitude, sisterCity.latitude, sisterCity.longitude)
        });
        
        citiesWithSisters.add(cityId);
        citiesWithSisters.add(sisterCityId);
      }
    }
  }
  
  console.log(`Found ${connections.length} sister city connections between ${citiesWithSisters.size} cities`);
  return { connections, citiesWithSisters };
}

/**
 * Calculate distance between two points in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Generate HTML visualization
 */
function generateHTML(cities, connections, citiesWithSisters) {
  const citiesArray = Array.from(citiesWithSisters).map(id => cities[id]).filter(Boolean);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sister Cities Network</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: #1a237e;
            color: white;
            padding: 20px;
            text-align: center;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
        }
        .stat {
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #1a237e;
        }
        .stat-label {
            color: #666;
            margin-top: 5px;
        }
        #map {
            width: 100%;
            height: 600px;
            border: none;
        }
        .controls {
            padding: 20px;
            border-top: 1px solid #dee2e6;
            background: #f8f9fa;
        }
        .info {
            padding: 20px;
            line-height: 1.6;
        }
        .connection-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            margin-top: 10px;
        }
        .connection-item {
            padding: 10px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .connection-item:last-child {
            border-bottom: none;
        }
        .connection-cities {
            font-weight: bold;
        }
        .connection-distance {
            color: #666;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Sister Cities Network</h1>
            <p>Global partnerships between cities visualized</p>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number">${citiesArray.length}</div>
                <div class="stat-label">Cities with Sister Cities</div>
            </div>
            <div class="stat">
                <div class="stat-number">${connections.length}</div>
                <div class="stat-label">Sister City Connections</div>
            </div>
            <div class="stat">
                <div class="stat-number">${Math.round(connections.reduce((sum, c) => sum + c.distance, 0) / connections.length)}</div>
                <div class="stat-label">Average Distance (km)</div>
            </div>
        </div>
        
        <svg id="map" viewBox="0 0 800 400">
            <!-- World map background -->
            <rect width="800" height="400" fill="#e3f2fd"/>
            
            <!-- Simplified world map -->
            <g id="countries" fill="#cfd8dc" stroke="#90a4ae" stroke-width="0.5">
                <!-- Simplified continent shapes -->
                <path d="M 100 100 L 300 80 L 350 150 L 280 200 L 120 180 Z" opacity="0.7"/>
                <path d="M 400 120 L 600 100 L 650 180 L 580 220 L 420 200 Z" opacity="0.7"/>
                <path d="M 150 250 L 250 240 L 280 300 L 200 320 L 160 290 Z" opacity="0.7"/>
                <path d="M 500 250 L 650 240 L 680 300 L 550 320 L 510 290 Z" opacity="0.7"/>
                <path d="M 50 300 L 150 290 L 180 350 L 100 370 L 60 340 Z" opacity="0.7"/>
                <path d="M 600 300 L 750 290 L 780 350 L 650 370 L 610 340 Z" opacity="0.7"/>
            </g>
            
            <!-- Sister city connections -->
            <g id="connections">
                ${connections.map(conn => {
                    const x1 = (conn.from.longitude + 180) * (800 / 360);
                    const y1 = (90 - conn.from.latitude) * (400 / 180);
                    const x2 = (conn.to.longitude + 180) * (800 / 360);
                    const y2 = (90 - conn.to.latitude) * (400 / 180);
                    
                    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" 
                                  stroke="#ff5722" stroke-width="1" opacity="0.6"
                                  data-from="${conn.from.name}" data-to="${conn.to.name}" 
                                  data-distance="${Math.round(conn.distance)}">
                                <title>${conn.from.name} ↔ ${conn.to.name} (${Math.round(conn.distance)} km)</title>
                            </line>`;
                }).join('')}
            </g>
            
            <!-- Cities -->
            <g id="cities">
                ${citiesArray.map(city => {
                    const x = (city.longitude + 180) * (800 / 360);
                    const y = (90 - city.latitude) * (400 / 180);
                    const size = Math.max(3, Math.min(8, (city.population || 100000) / 500000));
                    
                    return `<circle cx="${x}" cy="${y}" r="${size}" 
                                   fill="#1a237e" stroke="white" stroke-width="1" opacity="0.8"
                                   data-city="${city.name}" data-country="${city.country}" 
                                   data-population="${city.population || 'Unknown'}">
                                <title>${city.name} (${city.population ? city.population.toLocaleString() : 'Unknown population'})</title>
                            </circle>`;
                }).join('')}
            </g>
        </svg>
        
        <div class="info">
            <h3>Sister City Connections</h3>
            <p>This visualization shows sister city relationships from Wikidata. Lines connect cities that have formal sister city partnerships.</p>
            
            <div class="connection-list">
                ${connections.slice(0, 50).map(conn => `
                    <div class="connection-item">
                        <div class="connection-cities">${conn.from.name} ↔ ${conn.to.name}</div>
                        <div class="connection-distance">${Math.round(conn.distance)} km</div>
                    </div>
                `).join('')}
                ${connections.length > 50 ? `<div class="connection-item"><em>... and ${connections.length - 50} more connections</em></div>` : ''}
            </div>
        </div>
        
        <div class="controls">
            <p><strong>Data Source:</strong> Wikidata sister city relationships (P190)</p>
            <p><strong>Generated:</strong> ${new Date().toISOString().split('T')[0]}</p>
        </div>
    </div>
    
    <script>
        // Add interactivity
        document.querySelectorAll('#connections line').forEach(line => {
            line.addEventListener('mouseenter', function() {
                this.style.strokeWidth = '2';
                this.style.opacity = '1';
            });
            line.addEventListener('mouseleave', function() {
                this.style.strokeWidth = '1';
                this.style.opacity = '0.6';
            });
        });
        
        document.querySelectorAll('#cities circle').forEach(circle => {
            circle.addEventListener('mouseenter', function() {
                this.style.r = parseFloat(this.getAttribute('r')) * 1.5;
                this.style.opacity = '1';
            });
            circle.addEventListener('mouseleave', function() {
                this.style.r = parseFloat(this.getAttribute('r')) / 1.5;
                this.style.opacity = '0.8';
            });
        });
    </script>
</body>
</html>`;
}

/**
 * Main function
 */
function main() {
  console.log('Starting sister cities plotting...');
  
  // Check if city data exists
  if (!fs.existsSync(CITY_DATA_PATH)) {
    console.error(`City data file not found: ${CITY_DATA_PATH}`);
    console.error('Please run the wikidata-cities scripts first to generate city data.');
    process.exit(1);
  }
  
  // Load and parse city data
  console.log('Loading city data...');
  const csvContent = fs.readFileSync(CITY_DATA_PATH, 'utf8');
  const cities = parseCityData(csvContent);
  
  // Load sister cities data from wikidata extraction
  console.log('Loading sister cities data...');
  const sisterCitiesMap = loadSisterCitiesFromWikidata();
  
  // Build network
  console.log('Building sister cities network...');
  const { connections, citiesWithSisters } = buildSisterCitiesNetwork(cities, sisterCitiesMap);
  
  if (connections.length === 0) {
    console.warn('No sister city connections found. Make sure the wikidata extraction includes sister cities data.');
    console.warn('You may need to re-run the wikidata extraction scripts.');
  }
  
  // Generate outputs
  console.log('Generating visualization...');
  const html = generateHTML(cities, connections, citiesWithSisters);
  fs.writeFileSync(OUTPUT_HTML, html);
  
  // Save processed data
  const outputData = {
    cities: Array.from(citiesWithSisters).map(id => cities[id]).filter(Boolean),
    connections: connections,
    stats: {
      totalCities: citiesWithSisters.size,
      totalConnections: connections.length,
      averageDistance: connections.length > 0 ? Math.round(connections.reduce((sum, c) => sum + c.distance, 0) / connections.length) : 0,
      generatedAt: new Date().toISOString()
    }
  };
  
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(outputData, null, 2));
  
  console.log(`\nSister cities plotting completed!`);
  console.log(`- Cities with sister cities: ${citiesWithSisters.size}`);
  console.log(`- Total connections: ${connections.length}`);
  console.log(`- Average distance: ${outputData.stats.averageDistance} km`);
  console.log(`\nOutputs generated:`);
  console.log(`- HTML visualization: ${OUTPUT_HTML}`);
  console.log(`- JSON data: ${OUTPUT_JSON}`);
  console.log(`\nOpen the HTML file in a browser to view the visualization.`);
}

// Run the main function
if (require.main === module) {
  main();
}

module.exports = { main, parseCityData, buildSisterCitiesNetwork };