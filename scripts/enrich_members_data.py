#!/usr/bin/env python3
"""
Script to enrich members-wikidata.json with coordinates, population, and country data
from city-data-deduplicated.csv and countries.csv
"""

import pandas as pd
import json
import os

def main():
    # Define file paths
    members_file = 'public-data/city-networks/eurocities/members-wikidata.json'
    city_data_file = 'serverless/autocomplete/src/city-data-deduplicated.csv'
    countries_file = 'scripts/data/countries.csv'
    output_file = 'public-data/city-networks/eurocities/members-wikidata-enriched.json'
    
    # Load members data
    with open(members_file, 'r') as f:
        members_data = json.load(f)
    
    # Load city data
    city_df = pd.read_csv(city_data_file)
    
    # Load countries data and create a lookup dictionary
    # Read and parse the CSV file manually to handle commas in country names
    country_lookup = {}
    with open(countries_file, 'r', encoding='utf-8') as f:
        # Skip header
        next(f)
        for line in f:
            parts = line.strip().split(',')
            if len(parts) >= 3 and parts[2]:  # Check if wikidata id exists
                # If there are more than 3 parts, the country name contains commas
                if len(parts) > 3:
                    # Reconstruct the country name
                    country_name = ','.join(parts[:-2])
                    wikidata_id = parts[-1]
                else:
                    country_name = parts[0]
                    wikidata_id = parts[2]
                country_lookup[wikidata_id] = country_name
    
    # Create a dictionary for quick lookup of city data by wikidata_id
    city_lookup = {}
    for _, row in city_df.iterrows():
        # Convert NaN values to null for JSON compatibility
        population = None if pd.isna(row['population']) else row['population']
        
        # Get country name from wikidata id
        country_id = row['countryWikidataId']
        country_name = country_lookup.get(country_id, None)
        
        city_lookup[row['cityWikidataId']] = {
            'wikidata_name': row['cityLabelEnglish'],
            'latitude': row['latitude'],
            'longitude': row['longitude'],
            'population': population,
            'country_id': country_id,
            'country_name': country_name
        }
    
    # Enrich members data
    for member in members_data['members']:
        wikidata_id = member['wikidata_id']
        if wikidata_id in city_lookup:
            city_info = city_lookup[wikidata_id]
            member['wikidata_name'] = city_info['wikidata_name']
            member['latitude'] = city_info['latitude']
            member['longitude'] = city_info['longitude']
            member['population'] = city_info['population']
            member['country'] = city_info['country_id']
            member['country_name'] = city_info['country_name']
    
    # Save enriched data with UTF-8 encoding
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(members_data, f, indent=2, ensure_ascii=False)
    
    print(f"Enriched data saved to {output_file}")

if __name__ == "__main__":
    main()
