# Country Population Data

Scripts to retrieve country population data from Wikidata and add it to the countries.ts file.

## Usage

1. Run the SPARQL query to get the latest population data:
   ```
   cd scripts/country_population
   node country_population_script.js
   ```

2. Update the countries.ts file with the population data:
   ```
   cd scripts/country_population
   node join_country_data.js
   ```

## Data Structure

The updated countries.ts file includes:
- Population values as numbers (not strings)
- Null values for missing population data
- Determination dates for each population value
