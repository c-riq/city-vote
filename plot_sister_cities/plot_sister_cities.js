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
  
  // Extract countries data for filter
  const countries = [
    ["Afghanistan","AF","AFG","004","Q889"],
    ["Albania","AL","ALB","008","Q222"],
    ["Algeria","DZ","DZA","012","Q262"],
    ["Andorra","AD","AND","020","Q228"],
    ["Angola","AO","AGO","024","Q916"],
    ["Argentina","AR","ARG","032","Q414"],
    ["Armenia","AM","ARM","051","Q399"],
    ["Australia","AU","AUS","036","Q408"],
    ["Austria","AT","AUT","040","Q40"],
    ["Azerbaijan","AZ","AZE","031","Q227"],
    ["Bahrain","BH","BHR","048","Q398"],
    ["Bangladesh","BD","BGD","050","Q902"],
    ["Belarus","BY","BLR","112","Q184"],
    ["Belgium","BE","BEL","056","Q31"],
    ["Benin","BJ","BEN","204","Q962"],
    ["Bhutan","BT","BTN","064","Q917"],
    ["Bolivia","BO","BOL","068","Q750"],
    ["Bosnia and Herzegovina","BA","BIH","070","Q225"],
    ["Botswana","BW","BWA","072","Q963"],
    ["Brazil","BR","BRA","076","Q155"],
    ["Brunei Darussalam","BN","BRN","096","Q921"],
    ["Bulgaria","BG","BGR","100","Q219"],
    ["Burkina Faso","BF","BFA","854","Q965"],
    ["Burundi","BI","BDI","108","Q967"],
    ["Cambodia","KH","KHM","116","Q424"],
    ["Cameroon","CM","CMR","120","Q1009"],
    ["Canada","CA","CAN","124","Q16"],
    ["Central African Republic","CF","CAF","140","Q929"],
    ["Chad","TD","TCD","148","Q657"],
    ["Chile","CL","CHL","152","Q298"],
    ["China","CN","CHN","156","Q148"],
    ["Colombia","CO","COL","170","Q739"],
    ["Democratic Republic of the Congo","CD","COD","180","Q974"],
    ["Congo","CG","COG","178","Q971"],
    ["Costa Rica","CR","CRI","188","Q800"],
    ["Croatia","HR","HRV","191","Q224"],
    ["Cuba","CU","CUB","192","Q241"],
    ["Cyprus","CY","CYP","196","Q229"],
    ["Czechia","CZ","CZE","203","Q213"],
    ["Denmark","DK","DNK","208","Q35"],
    ["Djibouti","DJ","DJI","262","Q977"],
    ["Dominican Republic","DO","DOM","214","Q786"],
    ["Ecuador","EC","ECU","218","Q736"],
    ["Egypt","EG","EGY","818","Q79"],
    ["El Salvador","SV","SLV","222","Q792"],
    ["Estonia","EE","EST","233","Q191"],
    ["Ethiopia","ET","ETH","231","Q115"],
    ["Finland","FI","FIN","246","Q33"],
    ["France","FR","FRA","250","Q142"],
    ["Gabon","GA","GAB","266","Q1000"],
    ["Georgia","GE","GEO","268","Q230"],
    ["Germany","DE","DEU","276","Q183"],
    ["Ghana","GH","GHA","288","Q117"],
    ["Greece","GR","GRC","300","Q41"],
    ["Guatemala","GT","GTM","320","Q774"],
    ["Guinea","GN","GIN","324","Q1006"],
    ["Hungary","HU","HUN","348","Q28"],
    ["Iceland","IS","ISL","352","Q189"],
    ["India","IN","IND","356","Q668"],
    ["Indonesia","ID","IDN","360","Q252"],
    ["Iran","IR","IRN","364","Q794"],
    ["Iraq","IQ","IRQ","368","Q796"],
    ["Ireland","IE","IRL","372","Q27"],
    ["Israel","IL","ISR","376","Q801"],
    ["Italy","IT","ITA","380","Q38"],
    ["Japan","JP","JPN","392","Q17"],
    ["Jordan","JO","JOR","400","Q810"],
    ["Kazakhstan","KZ","KAZ","398","Q232"],
    ["Kenya","KE","KEN","404","Q114"],
    ["South Korea","KR","KOR","410","Q884"],
    ["Kyrgyzstan","KG","KGZ","417","Q813"],
    ["Latvia","LV","LVA","428","Q211"],
    ["Lebanon","LB","LBN","422","Q822"],
    ["Liberia","LR","LBR","430","Q1014"],
    ["Libya","LY","LBY","434","Q1016"],
    ["Lithuania","LT","LTU","440","Q37"],
    ["Luxembourg","LU","LUX","442","Q32"],
    ["Madagascar","MG","MDG","450","Q1019"],
    ["Malawi","MW","MWI","454","Q1020"],
    ["Malaysia","MY","MYS","458","Q833"],
    ["Mali","ML","MLI","466","Q912"],
    ["Malta","MT","MLT","470","Q233"],
    ["Mauritania","MR","MRT","478","Q1025"],
    ["Mexico","MX","MEX","484","Q96"],
    ["Moldova","MD","MDA","498","Q217"],
    ["Mongolia","MN","MNG","496","Q711"],
    ["Montenegro","ME","MNE","499","Q236"],
    ["Morocco","MA","MAR","504","Q1028"],
    ["Mozambique","MZ","MOZ","508","Q1029"],
    ["Myanmar","MM","MMR","104","Q836"],
    ["Namibia","NA","NAM","516","Q1030"],
    ["Nepal","NP","NPL","524","Q837"],
    ["Netherlands","NL","NLD","528","Q55"],
    ["New Zealand","NZ","NZL","554","Q664"],
    ["Nicaragua","NI","NIC","558","Q811"],
    ["Niger","NE","NER","562","Q1032"],
    ["Nigeria","NG","NGA","566","Q1033"],
    ["Norway","NO","NOR","578","Q20"],
    ["Pakistan","PK","PAK","586","Q843"],
    ["Palestine","PS","PSE","275","Q219060"],
    ["Paraguay","PY","PRY","600","Q733"],
    ["Philippines","PH","PHL","608","Q928"],
    ["Poland","PL","POL","616","Q36"],
    ["Portugal","PT","PRT","620","Q45"],
    ["Qatar","QA","QAT","634","Q846"],
    ["North Macedonia","MK","MKD","807","Q221"],
    ["Romania","RO","ROU","642","Q218"],
    ["Russia","RU","RUS","643","Q159"],
    ["Rwanda","RW","RWA","646","Q1037"],
    ["Saudi Arabia","SA","SAU","682","Q851"],
    ["Senegal","SN","SEN","686","Q1041"],
    ["Sierra Leone","SL","SLE","694","Q1044"],
    ["Singapore","SG","SGP","702","Q334"],
    ["Slovakia","SK","SVK","703","Q214"],
    ["Slovenia","SI","SVN","705","Q215"],
    ["Somalia","SO","SOM","706","Q1045"],
    ["South Africa","ZA","ZAF","710","Q258"],
    ["South Sudan","SS","SSD","728","Q958"],
    ["Spain","ES","ESP","724","Q29"],
    ["Sri Lanka","LK","LKA","144","Q854"],
    ["Sudan","SD","SDN","729","Q1049"],
    ["Sweden","SE","SWE","752","Q34"],
    ["Switzerland","CH","CHE","756","Q39"],
    ["Taiwan","TW","TWN","158","Q865"],
    ["Tajikistan","TJ","TJK","762","Q863"],
    ["Tanzania, United Republic of","TZ","TZA","834","Q924"],
    ["Thailand","TH","THA","764","Q869"],
    ["Togo","TG","TGO","768","Q945"],
    ["Tunisia","TN","TUN","788","Q948"],
    ["Turkey","TR","TUR","792","Q43"],
    ["Turkmenistan","TM","TKM","795","Q874"],
    ["Uganda","UG","UGA","800","Q1036"],
    ["Ukraine","UA","UKR","804","Q212"],
    ["United Arab Emirates","AE","ARE","784","Q878"],
    ["United Kingdom","GB","GBR","826","Q145"],
    ["United States of America","US","USA","840","Q30"],
    ["Uruguay","UY","URY","858","Q77"],
    ["Uzbekistan","UZ","UZB","860","Q265"],
    ["Venezuela","VE","VEN","862","Q717"],
    ["Viet Nam","VN","VNM","704","Q881"],
    ["Yemen","YE","YEM","887","Q805"],
    ["Zambia","ZM","ZMB","894","Q953"],
    ["Zimbabwe","ZW","ZWE","716","Q954"]
  ];
  
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
            padding: 10px;
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
        .map-container {
            margin: 0;
            padding: 0;
        }
        .header {
            background: #1a237e;
            color: white;
            padding: 12px;
            text-align: center;
        }
        .stats {
            display: flex;
            justify-content: space-around;
            padding: 8px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
        }
        .stat {
            text-align: center;
        }
        .stat-number {
            font-size: 1.4em;
            font-weight: bold;
            color: #1a237e;
        }
        .stat-label {
            color: #666;
            margin-top: 2px;
            font-size: 12px;
        }
        #map {
            width: 100%;
            height: auto;
            max-height: 60vh;
            border: none;
        }
        @media (max-width: 768px) {
            #map {
                max-height: 50vh;
            }
        }
        .controls {
            padding: 15px;
            border-top: 1px solid #dee2e6;
            background: #f8f9fa;
        }
        .info {
            padding: 15px;
            line-height: 1.5;
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
            opacity: 0.8;
            cursor: pointer;
            transition: none;
        }
        
        .city-circle.filtered-match {
            fill: #ff5722;
            opacity: 0.8;
        }
        
        .city-circle.filtered-connection {
            fill: #2196f3;
            opacity: 0.6;
        }
        
        .connection-path.filtered-connection {
            stroke: #2196f3;
            stroke-width: 1;
            opacity: 0.3;
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
            <h2 style="margin: 0 0 8px 0;">Sister Cities Network</h2>
            <p style="margin: 0; font-size: 14px;">Data from <a href="https://www.wikidata.org" target="_blank" style="color: #90caf9;">Wikidata</a> • Hover over cities to see connections</p>
        </div>
        
        <div class="controls">
            <div style="display: flex; gap: 15px; margin-bottom: 10px; flex-wrap: wrap; align-items: end;">
                <div style="flex: 1; min-width: 200px;">
                    <label for="cityFilter" style="display: block; margin-bottom: 3px; font-size: 13px; font-weight: bold;">Filter by City:</label>
                    <input type="text" id="cityFilter" placeholder="Type city name..."
                           style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    <div id="cityAutocomplete" style="position: relative; background: white; border: 1px solid #ddd; border-top: none; max-height: 150px; overflow-y: auto; display: none; font-size: 13px;"></div>
                </div>
                <div style="flex: 1; min-width: 200px;">
                    <label for="countryFilter" style="display: block; margin-bottom: 3px; font-size: 13px; font-weight: bold;">Filter by Country:</label>
                    <select id="countryFilter" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                        <option value="">All Countries</option>
                        ${countries.map(country => `<option value="${country[4]}">${country[0]}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <button id="clearFilters" style="padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">Clear</button>
                </div>
            </div>
            <div style="font-size: 12px;">
                <span style="color: #ff5722;">● Matches</span> | <span style="color: #2196f3;">● Connected</span> | <span style="color: #1a237e;">● Other</span>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number" id="totalCities">${citiesArray.length}</div>
                <div class="stat-label">Cities with Sister Cities</div>
            </div>
            <div class="stat">
                <div class="stat-number" id="totalConnections">${connections.length}</div>
                <div class="stat-label">Sister City Connections</div>
            </div>
            <div class="stat">
                <div class="stat-number" id="totalPopulation">${(() => {
                    const totalPop = citiesArray.reduce((sum, city) => sum + (city.population || 0), 0);
                    if (totalPop >= 1000000000) {
                        return (totalPop / 1000000000).toFixed(1) + 'B';
                    } else {
                        return Math.round(totalPop / 1000000) + 'M';
                    }
                })()}</div>
                <div class="stat-label">Total Population</div>
            </div>
        </div>
        
        <div class="map-container">
            <svg id="map" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
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
        </div>
        
        <div id="hoverInfo" style="padding: 12px; background: #f8f9fa; border: 1px solid #dee2e6; margin: 8px 0; min-height: 50px; display: none;">
            <div style="display: flex; gap: 20px;">
                <div style="flex: 1;">
                    <strong style="font-size: 13px;">Hovered City:</strong>
                    <div id="hoveredCity" style="margin-top: 3px; font-size: 13px;"></div>
                </div>
                <div style="flex: 2;">
                    <strong style="font-size: 13px;">Sister Cities:</strong>
                    <div id="sisterCities" style="margin-top: 3px; font-size: 13px; max-height: 80px; overflow-y: auto;"></div>
                </div>
            </div>
        </div>
        
        <div class="info">
            <p style="margin: 0 0 10px 0; font-size: 14px;">Sister city relationships from <a href="https://www.wikidata.org" target="_blank">Wikidata</a>. Hover over cities to see connections. Circle size indicates connection count.</p>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <p style="margin: 0; font-size: 12px; color: #666;">Generated: ${new Date().toISOString().split('T')[0]} • Data source: Wikidata P190 (sister city relationships)</p>
                <a href="https://city-vote.com/about" target="_blank" style="display: flex; align-items: center; text-decoration: none; color: #1a237e;">
                    <img src="img/logo.png" alt="City Vote" style="height: 18px; margin-right: 6px;">
                    <span style="font-size: 12px; font-weight: bold;">City Vote</span>
                </a>
            </div>
        </div>
    </div>
    
    <script>
        // Ultra-fast highlighting using data attributes and CSS
        const connectionData = ${JSON.stringify(connectionData)};
        const svg = document.getElementById('map');
        let currentHighlighted = null;
        
        // SVG zoom and pan functionality
        let isZooming = false;
        let isPanning = false;
        let startX, startY;
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        
        // Create a group element to contain all map content for transformations
        const mapGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        mapGroup.id = 'mapGroup';
        
        // Move all existing content into the group
        const existingContent = Array.from(svg.children);
        existingContent.forEach(child => {
            if (child.tagName !== 'defs') {
                mapGroup.appendChild(child);
            }
        });
        svg.appendChild(mapGroup);
        
        function updateTransform() {
            mapGroup.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);
            
            // Adjust visual elements based on zoom level
            const inverseScale = 1 / scale;
            const minStrokeWidth = 0.2;
            const maxStrokeWidth = 1;
            
            // Adjust connection line thickness
            document.querySelectorAll('.connection-path').forEach(path => {
                const baseWidth = path.classList.contains('filtered-connection') ? 1 : 0.5;
                const newWidth = Math.max(minStrokeWidth, Math.min(maxStrokeWidth, baseWidth * inverseScale));
                path.style.strokeWidth = newWidth;
            });
            
            // Adjust highlighted connection lines
            document.querySelectorAll('.connection-path[data-highlight="true"]').forEach(path => {
                const newWidth = Math.max(minStrokeWidth, Math.min(maxStrokeWidth, 1 * inverseScale));
                path.style.strokeWidth = newWidth;
            });
            
            // Adjust city circle sizes - only make smaller when zoomed in, not larger when zoomed out
            document.querySelectorAll('.city-circle').forEach(circle => {
                const baseRadius = parseFloat(circle.getAttribute('data-base-radius')) || parseFloat(circle.getAttribute('r')) || 2;
                if (!circle.hasAttribute('data-base-radius')) {
                    circle.setAttribute('data-base-radius', baseRadius);
                }
                
                // Only apply scaling if zoomed in (scale > 1), otherwise keep original size
                if (scale > 1) {
                    // Very aggressive scaling for high zoom levels
                    let scaleFactor = inverseScale;
                    if (scale > 4) {
                        // Extreme reduction for very high zoom levels
                        scaleFactor = scaleFactor * 0.4;
                    } else if (scale > 3) {
                        // Heavy reduction for high zoom levels
                        scaleFactor = scaleFactor * 0.5;
                    } else if (scale > 2) {
                        // Moderate reduction for medium zoom levels
                        scaleFactor = scaleFactor * 0.7;
                    } else {
                        // Light reduction for low zoom levels
                        scaleFactor = scaleFactor * 0.85;
                    }
                    const newRadius = Math.max(0.2, baseRadius * scaleFactor);
                    circle.setAttribute('r', newRadius);
                } else {
                    circle.setAttribute('r', baseRadius);
                }
            });
            
            // Adjust city label font sizes - only make smaller when zoomed in
            document.querySelectorAll('.city-label').forEach(label => {
                const baseFontSize = 9;
                const scaleFactor = scale > 1 ? inverseScale : 1;
                const newFontSize = Math.max(6, baseFontSize * scaleFactor);
                label.style.fontSize = newFontSize + 'px';
                
                // Adjust stroke width for labels
                const newStrokeWidth = Math.max(0.3, 0.8 * scaleFactor);
                label.style.strokeWidth = newStrokeWidth;
            });
        }
        
        // Mouse wheel zoom
        svg.addEventListener('wheel', function(e) {
            e.preventDefault();
            const rect = svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.max(1.0, Math.min(5, scale * zoomFactor));
            
            if (newScale !== scale) {
                // Zoom towards mouse position
                const scaleChange = newScale / scale;
                translateX = mouseX - (mouseX - translateX) * scaleChange;
                translateY = mouseY - (mouseY - translateY) * scaleChange;
                scale = newScale;
                updateTransform();
            }
        });
        
        // Mouse drag pan
        svg.addEventListener('mousedown', function(e) {
            if (e.button === 0) { // Left mouse button
                isPanning = true;
                startX = e.clientX - translateX;
                startY = e.clientY - translateY;
                svg.style.cursor = 'grabbing';
            }
        });
        
        document.addEventListener('mousemove', function(e) {
            if (isPanning) {
                translateX = e.clientX - startX;
                translateY = e.clientY - startY;
                updateTransform();
            }
        });
        
        document.addEventListener('mouseup', function(e) {
            if (isPanning) {
                isPanning = false;
                svg.style.cursor = 'grab';
            }
        });
        
        // Touch support for mobile
        let lastTouchDistance = 0;
        
        svg.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                isPanning = true;
                startX = e.touches[0].clientX - translateX;
                startY = e.touches[0].clientY - translateY;
            } else if (e.touches.length === 2) {
                isPanning = false;
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                lastTouchDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
            }
            e.preventDefault();
        });
        
        svg.addEventListener('touchmove', function(e) {
            if (e.touches.length === 1 && isPanning) {
                translateX = e.touches[0].clientX - startX;
                translateY = e.touches[0].clientY - startY;
                updateTransform();
            } else if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.sqrt(
                    Math.pow(touch2.clientX - touch1.clientX, 2) +
                    Math.pow(touch2.clientY - touch1.clientY, 2)
                );
                
                if (lastTouchDistance > 0) {
                    const zoomFactor = currentDistance / lastTouchDistance;
                    const newScale = Math.max(1.0, Math.min(5, scale * zoomFactor));
                    
                    if (newScale !== scale) {
                        const centerX = (touch1.clientX + touch2.clientX) / 2;
                        const centerY = (touch1.clientY + touch2.clientY) / 2;
                        const rect = svg.getBoundingClientRect();
                        const mouseX = centerX - rect.left;
                        const mouseY = centerY - rect.top;
                        
                        const scaleChange = newScale / scale;
                        translateX = mouseX - (mouseX - translateX) * scaleChange;
                        translateY = mouseY - (mouseY - translateY) * scaleChange;
                        scale = newScale;
                        updateTransform();
                    }
                }
                lastTouchDistance = currentDistance;
            }
            e.preventDefault();
        });
        
        svg.addEventListener('touchend', function(e) {
            isPanning = false;
            lastTouchDistance = 0;
        });
        
        // Set initial cursor
        svg.style.cursor = 'grab';
        
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
            
            // Show hover information
            showHoverInfo(cityId, connections);
            
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
            
            // Hide hover information
            document.getElementById('hoverInfo').style.display = 'none';
            
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
        
        function showHoverInfo(cityId, connections) {
            const city = allCities.find(c => c.id === cityId);
            if (!city) return;
            
            // Show hover info panel
            document.getElementById('hoverInfo').style.display = 'block';
            
            // Update hovered city info
            document.getElementById('hoveredCity').innerHTML = \`
                <strong>\${city.name}</strong><br>
                <small>Population: \${city.population ? city.population.toLocaleString() : 'Unknown'}</small>
            \`;
            
            // Update sister cities list
            const sisterCitiesList = connections.map(conn => conn.name).sort().join(', ');
            document.getElementById('sisterCities').innerHTML = \`
                <div>\${connections.length} sister cities: \${sisterCitiesList}</div>
            \`;
        }
        
        // Filter functionality
        const allCities = ${JSON.stringify(citiesArray)};
        const allConnections = ${JSON.stringify(connections)};
        let filteredCities = new Set();
        let isFiltered = false;
        
        const cityFilter = document.getElementById('cityFilter');
        const countryFilter = document.getElementById('countryFilter');
        const clearFiltersBtn = document.getElementById('clearFilters');
        const cityAutocomplete = document.getElementById('cityAutocomplete');
        
        // City autocomplete functionality
        cityFilter.addEventListener('input', function() {
            const query = this.value.toLowerCase().trim();
            
            if (query.length < 2) {
                cityAutocomplete.style.display = 'none';
                return;
            }
            
            const matches = allCities
                .filter(city => city.name.toLowerCase().includes(query))
                .slice(0, 10)
                .sort((a, b) => a.name.localeCompare(b.name));
            
            if (matches.length > 0) {
                cityAutocomplete.innerHTML = matches
                    .map(city => \`<div style="padding: 8px; cursor: pointer; border-bottom: 1px solid #eee;"
                                       onmouseover="this.style.background='#f0f0f0'"
                                       onmouseout="this.style.background='white'"
                                       onclick="selectCity('\${city.id}', '\${city.name.replace(/'/g, "\\\\'")}')">
                                       \${city.name}
                                   </div>\`)
                    .join('');
                cityAutocomplete.style.display = 'block';
            } else {
                cityAutocomplete.style.display = 'none';
            }
        });
        
        // Hide autocomplete when clicking outside
        document.addEventListener('click', function(e) {
            if (!cityFilter.contains(e.target) && !cityAutocomplete.contains(e.target)) {
                cityAutocomplete.style.display = 'none';
            }
        });
        
        window.selectCity = function(cityId, cityName) {
            cityFilter.value = cityName;
            cityAutocomplete.style.display = 'none';
            applyFilters();
        };
        
        // Country filter
        countryFilter.addEventListener('change', applyFilters);
        
        // Clear filters
        clearFiltersBtn.addEventListener('click', function() {
            cityFilter.value = '';
            countryFilter.value = '';
            clearFilters();
        });
        
        function applyFilters() {
            const cityQuery = cityFilter.value.toLowerCase().trim();
            const countryId = countryFilter.value;
            
            filteredCities.clear();
            isFiltered = cityQuery || countryId;
            
            if (!isFiltered) {
                clearFilters();
                return;
            }
            
            
            // Filter cities
            allCities.forEach(city => {
                let matches = true;
                
                if (cityQuery && city.name.toLowerCase() !== cityQuery) {
                    matches = false;
                }
                
                if (countryId) {
                    // More robust country matching - handle potential data inconsistencies
                    const cityCountry = city.country;
                    if (cityCountry !== countryId) {
                        matches = false;
                    }
                }
                
                if (matches) {
                    filteredCities.add(city.id);
                }
            });
            
            
            // Apply visual filters
            updateVisualization();
            updateFilterStatus();
        }
        
        function clearFilters() {
            filteredCities.clear();
            isFiltered = false;
            
            // Reset all city colors to default
            document.querySelectorAll('#cities [data-city-id]').forEach(cityElement => {
                const circle = cityElement.querySelector('.city-circle') || cityElement.querySelector('circle');
                cityElement.style.display = 'block';
                if (circle) {
                    circle.setAttribute('class', 'city-circle');
                    circle.style.fill = '#1a237e';
                    circle.style.opacity = '0.8';
                }
            });
            
            // Show all labels
            document.querySelectorAll('#labels [data-city-id]').forEach(labelElement => {
                labelElement.style.display = 'block';
            });
            
            // Reset all connections
            document.querySelectorAll('.connection-path').forEach(pathElement => {
                pathElement.style.display = 'block';
                pathElement.className = 'connection-path';
            });
            
            updateFilterStatus();
        }
        
        function updateVisualization() {
            if (!isFiltered) {
                // No filter - show all cities normally
                document.querySelectorAll('#cities [data-city-id]').forEach(cityElement => {
                    const circle = cityElement.querySelector('.city-circle');
                    cityElement.style.display = 'block';
                    circle.className = 'city-circle';
                });
                
                document.querySelectorAll('#labels [data-city-id]').forEach(labelElement => {
                    labelElement.style.display = 'block';
                });
                
                document.querySelectorAll('.connection-path').forEach(pathElement => {
                    pathElement.style.display = 'block';
                    pathElement.className = 'connection-path';
                });
                return;
            }
            
            // Build set of all connected cities
            const connectedCities = new Set();
            filteredCities.forEach(cityId => {
                const connections = connectionData[cityId];
                if (connections) {
                    connections.forEach(conn => {
                        connectedCities.add(conn.connectedCityId);
                    });
                }
            });
            
            // Update city circles with different colors
            document.querySelectorAll('#cities [data-city-id]').forEach(cityElement => {
                const cityId = cityElement.getAttribute('data-city-id');
                const circle = cityElement.querySelector('.city-circle') || cityElement.querySelector('circle');
                
                if (filteredCities.has(cityId)) {
                    // City matches filter - show in orange
                    cityElement.style.display = 'block';
                    if (circle) {
                        circle.setAttribute('class', 'city-circle filtered-match');
                        // Also set inline styles as fallback
                        circle.style.fill = '#ff5722';
                        circle.style.opacity = '0.8';
                    }
                } else if (connectedCities.has(cityId)) {
                    // City is connected to filtered cities - show in blue
                    cityElement.style.display = 'block';
                    if (circle) {
                        circle.setAttribute('class', 'city-circle filtered-connection');
                        // Also set inline styles as fallback
                        circle.style.fill = '#2196f3';
                        circle.style.opacity = '0.6';
                    }
                } else {
                    // Hide other cities
                    cityElement.style.display = 'none';
                    if (circle) {
                        circle.setAttribute('class', 'city-circle');
                        circle.style.fill = '#1a237e';
                        circle.style.opacity = '0.8';
                    }
                }
            });
            
            // Update labels
            document.querySelectorAll('#labels [data-city-id]').forEach(labelElement => {
                const cityId = labelElement.getAttribute('data-city-id');
                
                if (filteredCities.has(cityId) || connectedCities.has(cityId)) {
                    labelElement.style.display = 'block';
                } else {
                    labelElement.style.display = 'none';
                }
            });
            
            // Update connections - only show connections that involve at least one matching city
            document.querySelectorAll('.connection-path').forEach(pathElement => {
                const fromId = pathElement.getAttribute('data-from-id');
                const toId = pathElement.getAttribute('data-to-id');
                
                // Only show connections where at least one city matches the filter
                const fromMatches = filteredCities.has(fromId);
                const toMatches = filteredCities.has(toId);
                const connectionInvolvesMatch = fromMatches || toMatches;
                
                if (connectionInvolvesMatch) {
                    pathElement.style.display = 'block';
                    pathElement.className = 'connection-path filtered-connection';
                } else {
                    // Hide connections between non-matching cities (even if they're visible as connected cities)
                    pathElement.style.display = 'none';
                }
            });
        }
        
        function updateFilterStatus() {
            if (!isFiltered) {
                // Reset to original stats
                document.getElementById('totalCities').textContent = '${citiesArray.length}';
                document.getElementById('totalConnections').textContent = '${connections.length}';
                const totalPop = ${citiesArray.reduce((sum, city) => sum + (city.population || 0), 0)};
                const popDisplay = totalPop >= 1000000000 ? (totalPop / 1000000000).toFixed(1) + 'B' : Math.round(totalPop / 1000000) + 'M';
                document.getElementById('totalPopulation').textContent = popDisplay;
                return;
            }
            
            const visibleCities = filteredCities.size;
            const visibleConnections = allConnections.filter(conn =>
                filteredCities.has(conn.from.id) || filteredCities.has(conn.to.id)
            ).length;
            
            // Calculate filtered population
            const filteredPopulation = Array.from(filteredCities).reduce((sum, cityId) => {
                const city = allCities.find(c => c.id === cityId);
                return sum + (city?.population || 0);
            }, 0);
            const filteredPopDisplay = filteredPopulation >= 1000000000 ?
                (filteredPopulation / 1000000000).toFixed(1) + 'B' :
                Math.round(filteredPopulation / 1000000) + 'M';
            
            // Update main stats to show filtered values
            document.getElementById('totalCities').textContent = visibleCities;
            document.getElementById('totalConnections').textContent = visibleConnections;
            document.getElementById('totalPopulation').textContent = filteredPopDisplay;
        }
        
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