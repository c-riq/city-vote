import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

// Interface for registration code storage
interface RegistrationCode {
    code: string;
    used: boolean;
    usedAt?: string;
    usedBy?: string;
}

// Number of registration codes to generate
const NUM_CODES = 300;

// Create the auth directory if it doesn't exist
const authDir = path.join(process.cwd(), '../data/auth');
if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
}

// Path to the registration codes file
const registrationCodesPath = path.join(authDir, 'registration_codes.json');

// Check if the file already exists
let existingCodes: Record<string, RegistrationCode> = {};
if (fs.existsSync(registrationCodesPath)) {
    try {
        existingCodes = JSON.parse(fs.readFileSync(registrationCodesPath, 'utf8'));
        console.log(`Found ${Object.keys(existingCodes).length} existing registration codes.`);
    } catch (error) {
        console.error('Error reading existing registration codes:', error);
    }
}

// Generate new registration codes
const registrationCodes: Record<string, RegistrationCode> = { ...existingCodes };
let newCodesCount = 0;

for (let i = 0; i < NUM_CODES; i++) {
    // Generate a random code (16 bytes, base64 encoded, URL-safe, no special chars)
    const code = crypto.randomBytes(16)
        .toString('base64')
        .replace(/\+/g, 'X')
        .replace(/\//g, 'Y')
        .replace(/=/g, 'Z');
    
    // Skip if the code already exists
    if (registrationCodes[code]) {
        console.log(`Code ${code} already exists, skipping.`);
        continue;
    }
    
    // Add the new code
    registrationCodes[code] = {
        code,
        used: false
    };
    
    newCodesCount++;
}

// Write the registration codes to the file, but only if we have new codes to add
if (newCodesCount > 0) {
    fs.writeFileSync(
        registrationCodesPath,
        JSON.stringify(registrationCodes, null, 2),
        'utf8'
    );
    console.log(`Updated registration codes file: ${registrationCodesPath}`);
} else {
    console.log('No new codes were generated. File not modified.');
}

console.log(`Generated ${newCodesCount} new registration codes.`);
console.log(`Total registration codes: ${Object.keys(registrationCodes).length}`);
