# Wikidata Cities Extractor

Extracts city and municipality data from Wikidata dump.

## Usage

1. Update the configuration in `main.py` if needed:
   - `WIKIDATA_DUMP_PATH`: Path to the Wikidata dump file

2. Run the script:
   ```
   cd scripts/wikidata-cities
   python main.py
   ```
   
   Or directly:
   ```
   ./scripts/wikidata-cities/main.py
   ```

3. The output will be saved as JSON Lines files in the `scripts/data/cities` directory.

4. Combine the results into a single CSV file:
   ```
   ./scripts/wikidata-cities/combine_city_results.js
   ```

5. The combined CSV file will be saved to `serverless/autocomplete/src/city-data.csv`.