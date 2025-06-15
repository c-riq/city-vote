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
 * Generate great circle path points between two coordinates
 */
function generateGreatCirclePath(lat1, lon1, lat2, lon2, numPoints = 20) {
  // Check if the path crosses the 180th meridian
  const lonDiff = Math.abs(lon2 - lon1);
  const crossesDateLine = lonDiff > 180;
  
  
  // If crossing the date line, create two separate path segments
  if (crossesDateLine) {
    return generateDateLineCrossingPath(lat1, lon1, lat2, lon2, numPoints);
  }
  
  // Normal case - no date line crossing
  return generateGreatCircleSegment(lat1, lon1, lat2, lon2, numPoints);
}

/**
 * Generate path that crosses the date line as two separate segments
 */
function generateDateLineCrossingPath(lat1, lon1, lat2, lon2, numPoints) {
  // Determine which way is shorter around the globe
  const eastwardDistance = lon2 > lon1 ? lon2 - lon1 : (360 + lon2) - lon1;
  const westwardDistance = lon1 > lon2 ? lon1 - lon2 : (360 + lon1) - lon2;
  
  // Choose the shorter path
  if (eastwardDistance <= westwardDistance) {
    // Go eastward, crossing 180 to -180
    if (lon1 > lon2) {
      // Adjust lon2 to be on the correct side
      lon2 += 360;
    }
  } else {
    // Go westward, crossing -180 to 180
    if (lon2 > lon1) {
      // Adjust lon1 to be on the correct side
      lon1 += 360;
    }
  }
  
  // Now generate the path normally with adjusted coordinates
  const points = generateGreatCircleSegment(lat1, lon1, lat2, lon2, numPoints);
  
  // Normalize longitudes back to -180 to 180 range
  return points.map(([lon, lat]) => {
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    return [lon, lat];
  });
}

/**
 * Generate great circle segment without date line crossing
 */
function generateGreatCircleSegment(lat1, lon1, lat2, lon2, numPoints) {
  const points = [];
  
  // Convert to radians
  const lat1Rad = lat1 * Math.PI / 180;
  const lon1Rad = lon1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const lon2Rad = lon2 * Math.PI / 180;
  
  // Calculate the angular distance
  const d = Math.acos(Math.max(-1, Math.min(1,
    Math.sin(lat1Rad) * Math.sin(lat2Rad) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lon2Rad - lon1Rad)
  )));
  
  // If points are very close, just return straight line
  if (d < 0.01) {
    points.push([lon1, lat1]);
    points.push([lon2, lat2]);
    return points;
  }
  
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    
    const x = A * Math.cos(lat1Rad) * Math.cos(lon1Rad) + B * Math.cos(lat2Rad) * Math.cos(lon2Rad);
    const y = A * Math.cos(lat1Rad) * Math.sin(lon1Rad) + B * Math.cos(lat2Rad) * Math.sin(lon2Rad);
    const z = A * Math.sin(lat1Rad) + B * Math.sin(lat2Rad);
    
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    
    points.push([lon * 180 / Math.PI, lat * 180 / Math.PI]);
  }
  
  return points;
}

/**
 * Convert great circle path to SVG path string, handling date line crossings
 */
function pathToSVG(points) {
  if (points.length < 2) return '';
  
  let pathData = '';
  let currentPath = '';
  let lastX = null;
  
  for (let i = 0; i < points.length; i++) {
    const [lon, lat] = points[i];
    const x = (lon + 180) * (800 / 360);
    const y = (90 - lat) * (400 / 180);
    
    // Check for large jumps in X coordinate (date line crossing)
    if (lastX !== null && Math.abs(x - lastX) > 400) {
      // End current path and start a new one
      if (currentPath) {
        pathData += currentPath;
        currentPath = '';
      }
      currentPath += ` M ${x} ${y}`;
    } else {
      if (i === 0 || currentPath === '') {
        currentPath += `M ${x} ${y}`;
      } else {
        currentPath += ` L ${x} ${y}`;
      }
    }
    
    lastX = x;
  }
  
  // Add the final path segment
  if (currentPath) {
    pathData += currentPath;
  }
  
  return pathData;
}

/**
 * Generate HTML visualization
 */
function generateHTML(cities, connections, citiesWithSisters) {
  const citiesArray = Array.from(citiesWithSisters).map(id => cities[id]).filter(Boolean);
  
  // Build connection counts for all cities
  const connectionCounts = new Map();
  connections.forEach(conn => {
    connectionCounts.set(conn.from.id, (connectionCounts.get(conn.from.id) || 0) + 1);
    connectionCounts.set(conn.to.id, (connectionCounts.get(conn.to.id) || 0) + 1);
  });
  
  // Build connection data as JavaScript object for fast lookup
  const connectionData = {};
  connections.forEach((conn, index) => {
    if (!connectionData[conn.from.id]) connectionData[conn.from.id] = [];
    if (!connectionData[conn.to.id]) connectionData[conn.to.id] = [];
    
    connectionData[conn.from.id].push({
      connectedCityId: conn.to.id,
      pathIndex: index,
      name: conn.to.name
    });
    connectionData[conn.to.id].push({
      connectedCityId: conn.from.id,
      pathIndex: index,
      name: conn.from.name
    });
  });
  
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
        
        /* Efficient CSS-only highlighting using data attributes */
        .connection-path {
            stroke: #1a237e;
            stroke-width: 0.5;
            opacity: 0.05;
            fill: none;
            transition: none; /* Remove transitions for performance */
        }
        
        .city-circle {
            fill: #1a237e;
            stroke: none;
            opacity: 0.6;
            cursor: pointer;
            transition: none;
        }
        
        .city-label {
            font-size: 9px;
            fill: white;
            stroke: black;
            stroke-width: 0.8;
            stroke-linejoin: round;
            stroke-linecap: round;
            text-anchor: middle;
            pointer-events: none;
            opacity: 0;
            transition: none;
            paint-order: stroke fill; /* Stroke behind fill for better readability */
            filter: drop-shadow(1px 1px 1px rgba(0,0,0,0.8));
        }
        
        /* Highlighting styles - applied directly to elements */
        .connection-path[data-highlight="true"] {
            stroke: #ff5722;
            stroke-width: 1;
            opacity: 0.9;
        }
        
        [data-highlight="true"] .city-circle {
            fill: #ff5722;
            opacity: 1;
            stroke: none;
        }
        
        .city-label[data-highlight="true"] {
            opacity: 1;
            font-weight: bold;
            fill: white;
            stroke: #ff5722;
            stroke-width: 0.5;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Sister Cities Network</h1>
            <p>Global partnerships between cities visualized - Hover over cities to see their connections</p>
            <p><small>Showing all ${citiesArray.length} cities with sister city relationships</small></p>
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
            
            <!-- City circles (bottom layer) -->
            <g id="cities">
                ${citiesArray.map(city => {
                    const x = (city.longitude + 180) * (800 / 360);
                    const y = (90 - city.latitude) * (400 / 180);
                    const connectionCount = connectionCounts.get(city.id) || 0;
                    // Even smaller radius for cleaner look
                    const radius = Math.min(2.5, Math.max(1, 1 + connectionCount * 0.05));
                    
                    return `<g data-city-id="${city.id}">
                                <circle cx="${x}" cy="${y}" r="${radius}"
                                       class="city-circle">
                                    <title>${city.name} (${connectionCount} connections)</title>
                                </circle>
                            </g>`;
                }).join('')}
            </g>
            
            <!-- Sister city connections (middle layer) -->
            <g id="connections">
                ${connections.map((conn, index) => {
                    const pathPoints = generateGreatCirclePath(
                        conn.from.latitude, conn.from.longitude,
                        conn.to.latitude, conn.to.longitude,
                        Math.max(5, Math.min(20, Math.floor(conn.distance / 500)))
                    );
                    
                    const pathData = pathToSVG(pathPoints);
                    
                    return `<path d="${pathData}"
                                  class="connection-path"
                                  data-path-index="${index}"
                                  data-from-id="${conn.from.id}"
                                  data-to-id="${conn.to.id}"
                                  pointer-events="none">
                            </path>`;
                }).join('')}
            </g>
            
            <!-- City labels (top layer) -->
            <g id="labels">
                ${citiesArray.map(city => {
                    const x = (city.longitude + 180) * (800 / 360);
                    const y = (90 - city.latitude) * (400 / 180);
                    const connectionCount = connectionCounts.get(city.id) || 0;
                    const radius = Math.min(2.5, Math.max(1, 1 + connectionCount * 0.05));
                    
                    return `<text x="${x}" y="${y - radius - 1}"
                                  class="city-label"
                                  data-city-id="${city.id}">${city.name}</text>`;
                }).join('')}
            </g>
        </svg>
        
        <div class="info">
            <h3>Sister City Connections</h3>
            <p>This visualization shows sister city relationships from Wikidata. Hover over any city to see its connections highlighted.</p>
            <p><strong>Complete dataset:</strong> All ${citiesArray.length} cities with sister city relationships are displayed. City size indicates number of connections.</p>
        </div>
        
        <div class="controls">
            <p><strong>Data Source:</strong> Wikidata sister city relationships (P190)</p>
            <p><strong>Generated:</strong> ${new Date().toISOString().split('T')[0]}</p>
        </div>
    </div>
    
    <script>
        // Ultra-fast highlighting using data attributes and CSS
        const connectionData = ${JSON.stringify(connectionData)};
        const svg = document.getElementById('map');
        let currentHighlighted = null;
        
        // Single event listener using event delegation
        svg.addEventListener('mouseover', function(e) {
            // Check if we're hovering over a city circle or label
            const cityCircle = e.target.closest('#cities [data-city-id]');
            const cityLabel = e.target.closest('#labels [data-city-id]');
            
            let cityId = null;
            if (cityCircle) {
                cityId = cityCircle.getAttribute('data-city-id');
            } else if (cityLabel) {
                cityId = cityLabel.getAttribute('data-city-id');
            }
            
            if (cityId) {
                highlightCity(cityId);
            }
        });
        
        svg.addEventListener('mouseout', function(e) {
            // Check if we're leaving a city circle or label
            const cityCircle = e.target.closest('#cities [data-city-id]');
            const cityLabel = e.target.closest('#labels [data-city-id]');
            
            if (cityCircle || cityLabel) {
                clearHighlight();
            }
        });
        
        function highlightCity(cityId) {
            clearHighlight();
            
            const connections = connectionData[cityId];
            if (!connections) return;
            
            // Highlight the hovered city (circle and label)
            const cityElement = document.querySelector(\`#cities [data-city-id="\${cityId}"]\`);
            const cityLabel = document.querySelector(\`#labels [data-city-id="\${cityId}"]\`);
            if (cityElement) {
                cityElement.setAttribute('data-highlight', 'true');
            }
            if (cityLabel) {
                cityLabel.setAttribute('data-highlight', 'true');
            }
            
            // Highlight connected cities and paths
            connections.forEach(conn => {
                // Highlight connected city (circle and label)
                const connectedCity = document.querySelector(\`#cities [data-city-id="\${conn.connectedCityId}"]\`);
                const connectedLabel = document.querySelector(\`#labels [data-city-id="\${conn.connectedCityId}"]\`);
                if (connectedCity) {
                    connectedCity.setAttribute('data-highlight', 'true');
                }
                if (connectedLabel) {
                    connectedLabel.setAttribute('data-highlight', 'true');
                }
                
                // Highlight connection path
                const path = document.querySelector(\`[data-path-index="\${conn.pathIndex}"]\`);
                if (path) {
                    path.setAttribute('data-highlight', 'true');
                }
            });
            
            currentHighlighted = { cityId, connections };
        }
        
        function clearHighlight() {
            if (!currentHighlighted) return;
            
            // Clear city highlight (circle and label)
            const cityElement = document.querySelector(\`#cities [data-city-id="\${currentHighlighted.cityId}"]\`);
            const cityLabel = document.querySelector(\`#labels [data-city-id="\${currentHighlighted.cityId}"]\`);
            if (cityElement) {
                cityElement.removeAttribute('data-highlight');
            }
            if (cityLabel) {
                cityLabel.removeAttribute('data-highlight');
            }
            
            // Clear connected cities and paths
            currentHighlighted.connections.forEach(conn => {
                const connectedCity = document.querySelector(\`#cities [data-city-id="\${conn.connectedCityId}"]\`);
                const connectedLabel = document.querySelector(\`#labels [data-city-id="\${conn.connectedCityId}"]\`);
                if (connectedCity) {
                    connectedCity.removeAttribute('data-highlight');
                }
                if (connectedLabel) {
                    connectedLabel.removeAttribute('data-highlight');
                }
                
                const path = document.querySelector(\`[data-path-index="\${conn.pathIndex}"]\`);
                if (path) {
                    path.removeAttribute('data-highlight');
                }
            });
            
            currentHighlighted = null;
        }
        
        console.log('Complete visualization ready! Showing all', ${citiesArray.length}, 'cities');
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