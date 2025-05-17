import { exec } from 'child_process';
import * as path from 'path';

console.log('Starting CSV splitting process...');

// Function to run a TypeScript file
function runTsFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Running ${filePath}...`);
    
    // Use ts-node to run the TypeScript file
    const command = `npx ts-node ${filePath}`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing ${filePath}:`, error);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.error(`stderr from ${filePath}:`, stderr);
      }
      
      console.log(stdout);
      console.log(`Finished running ${filePath}`);
      resolve();
    });
  });
}

async function main() {
  try {
    // Get the absolute paths to the scripts
    const splitByLetterPath = path.join(__dirname, 'split_csv_by_letter.ts');
    const splitByQidPath = path.join(__dirname, 'split_csv_by_qid.ts');
    
    // Run the scripts sequentially
    await runTsFile(splitByLetterPath);
    await runTsFile(splitByQidPath);
    
    console.log('CSV splitting completed successfully!');
  } catch (error) {
    console.error('Error during CSV splitting:', error);
    process.exit(1);
  }
}

// Run the main function
main();