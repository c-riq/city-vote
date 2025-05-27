/**
 * Script to fetch English labels for province IDs without labels in province_lookup.json
 */

import fetch from 'node-fetch';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function executeQuery(query) {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'Province Data Script/1.0'
      }
    });
    
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    return null;
  }
}

async function main() {
  console.log('Processing province lookup data...');
  
  // Path to the province_lookup.json file in the wikidata-cities directory
  const lookupFilePath = resolve(__dirname, '../wikidata-cities/data/cities/province_lookup.json');
  
  try {
    // Read the existing province_lookup.json file
    const provinceLookupData = JSON.parse(fs.readFileSync(lookupFilePath, 'utf8'));
    
    // Extract IDs without labels (where name is null)
    const idsWithoutLabels = [];
    
    for (const [id, data] of Object.entries(provinceLookupData)) {
      if (data.name === null) {
        idsWithoutLabels.push(id);
      }
    }
    
    console.log(`Found ${idsWithoutLabels.length} IDs without labels. Fetching English labels from Wikidata...`);
    
    // Process IDs in batches to avoid query length limitations
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < idsWithoutLabels.length; i += batchSize) {
      batches.push(idsWithoutLabels.slice(i, i + batchSize));
    }
    
    console.log(`Processing ${batches.length} batches of IDs...`);
    
    let updatedCount = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} IDs)...`);
      
      // Create SPARQL query to get English labels for this batch of IDs
      const idValues = batch.map(id => `wd:${id}`).join(' ');
      const sparqlQuery = `
        SELECT ?item ?itemLabel
        WHERE {
          VALUES ?item { ${idValues} }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
      `;
      
      const result = await executeQuery(sparqlQuery);
      
      if (result && result.results && result.results.bindings) {
        for (const binding of result.results.bindings) {
          const wikidataId = binding.item.value.split('/').pop();
          const label = binding.itemLabel?.value;
          
          if (wikidataId && label && provinceLookupData[wikidataId]) {
            provinceLookupData[wikidataId].name = label;
            updatedCount++;
          }
        }
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Write the updated data back to the file
    fs.writeFileSync(lookupFilePath, JSON.stringify(provinceLookupData, null, 2));
    console.log(`Updated ${updatedCount} province labels in ${lookupFilePath}`);
    
  } catch (error) {
    console.error('Error processing province lookup data:', error);
  }
}

main().catch(error => console.error('An error occurred:', error));
