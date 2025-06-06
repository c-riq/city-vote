import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the current file path and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the project root directory
const projectRoot = path.resolve(__dirname, '..');

// Paths to the source type files
const typeFilePaths = [
  path.join(projectRoot, 'serverless/autocomplete/src/types.ts'),
  path.join(projectRoot, 'serverless/public/src/types.ts'),
  path.join(projectRoot, 'serverless/vote/src/types.ts'),
  path.join(projectRoot, 'serverless/personal-auth/src/types.ts')
];

// Path to the output file
const outputFilePath = path.join(projectRoot, 'frontend/src/backendTypes.ts');

// Path to the countries file
const countriesSourcePath = path.join(projectRoot, 'serverless/autocomplete/src/countries.ts');
const countriesOutputPath = path.join(projectRoot, 'frontend/src/countries.ts');

// Main function
function main() {
  console.log('Starting to sync backend types...');
  
  // Header for the output file
  let outputContent = `// This file is auto-generated by sync-backend-types.ts script
// DO NOT EDIT DIRECTLY

`;
  
  // Read and concatenate each file
  for (const filePath of typeFilePaths) {
    console.log(`Reading types from ${filePath}...`);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      // Extract the relative path from the full path
      const relativePath = filePath.substring(projectRoot.length + 1);
      outputContent += `// From ${relativePath}\n${content}\n\n`;
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      process.exit(1);
    }
  }
  
  // Write the concatenated content to the output file
  try {
    fs.writeFileSync(outputFilePath, outputContent);
    console.log(`Successfully wrote types to ${outputFilePath}`);
  } catch (error) {
    console.error(`Error writing to ${outputFilePath}:`, error);
    process.exit(1);
  }
  
  // Sync countries.ts file
  console.log(`Syncing countries from ${countriesSourcePath}...`);
  try {
    const countriesContent = fs.readFileSync(countriesSourcePath, 'utf8');
    // Add header to indicate this is an auto-generated file
    const countriesOutputContent = `// This file is auto-generated by sync-backend-types.ts script
// DO NOT EDIT DIRECTLY
// Source: serverless/autocomplete/src/countries.ts

${countriesContent}`;
    
    fs.writeFileSync(countriesOutputPath, countriesOutputContent);
    console.log(`Successfully wrote countries to ${countriesOutputPath}`);
  } catch (error) {
    console.error(`Error syncing countries file:`, error);
    process.exit(1);
  }
}

// Run the main function
main();
