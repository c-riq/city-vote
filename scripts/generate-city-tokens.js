const fs = require('fs');
const crypto = require('crypto');

// Read the city data
const cityData = JSON.parse(fs.readFileSync('./data/cities/cities.json', 'utf8'));

// Generate tokens for each city
const invertedTokenMap = {};
const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
const expiryTime = Math.floor(Date.now() / 1000) + ONE_YEAR_IN_SECONDS;

Object.keys(cityData).forEach(cityId => {
    // Generate 32 random bytes and convert to URL-safe base64
    const token = crypto.randomBytes(32)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    // Append expiry timestamp to token
    const fullToken = `${token}_${expiryTime}`;
    invertedTokenMap[fullToken] = cityId;
});

// Write inverted map to JSON file
fs.writeFileSync(
    './data/auth/auth.json',
    JSON.stringify(invertedTokenMap, null, 2),
    'utf8'
);

console.log('Generated tokens for', Object.keys(invertedTokenMap).length, 'cities'); 