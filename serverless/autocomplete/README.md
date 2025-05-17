# City Vote Autocomplete Service

This service provides autocomplete functionality for city names in the City Vote application.

## Features

- Prefix-based city name search
- City lookup by Wikidata QID
- Optimized search using split CSV files

## Performance Optimizations

The autocomplete service has been optimized in two ways:

1. **Prefix-only matching**: The search now only matches cities whose names start with the query string, rather than matching any substring within the city name. This provides more relevant results and improves performance.

2. **Split CSV files**: The city data is split into multiple smaller CSV files to speed up searches:
   - By first letter of city name (A.csv, B.csv, etc.)
   - By first 2 digits of Wikidata QID (Q00.csv, Q01.csv, etc.)

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Generate the split CSV files:
   ```
   npm run split-csv
   ```

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and recompile
- `npm run clean` - Remove the dist directory
- `npm run deploy` - Clean, build, and deploy the service
- `npm run split-csv-letter` - Split the CSV file by first letter of city name
- `npm run split-csv-qid` - Split the CSV file by first 2 digits of QID
- `npm run split-csv` - Run both splitting scripts

## How It Works

### Autocomplete Search

When a user types a query:
1. The system extracts the first letter of the query
2. It loads the corresponding split CSV file (e.g., A.csv for queries starting with 'A')
3. It searches only within that file for cities whose names start with the query
4. Results are sorted by population (largest first)

### QID Lookup

When looking up a city by QID:
1. The system extracts the first 2 digits of the QID
2. It loads the corresponding split CSV file (e.g., Q01.csv for QIDs like Q0123)
3. It searches only within that file for the exact QID match

## Fallback Mechanism

If a split CSV file doesn't exist, the system falls back to using the original complete CSV file.