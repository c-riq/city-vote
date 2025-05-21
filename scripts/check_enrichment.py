#!/usr/bin/env python3
"""
Script to check the enrichment statistics of members-wikidata-enriched.json
"""

import json
import math

def main():
    # Define file path
    enriched_file = 'data/city-networks/eurocities/members-wikidata-enriched.json'
    
    # Load enriched data
    with open(enriched_file, 'r') as f:
        data = json.load(f)
    
    # Count statistics
    total_cities = len(data['members'])
    cities_with_name = sum(1 for m in data['members'] if 'wikidata_name' in m and m['wikidata_name'] is not None)
    cities_with_coords = sum(1 for m in data['members'] if 'latitude' in m and m['latitude'] is not None)
    cities_with_population = sum(1 for m in data['members'] if 'population' in m and m['population'] is not None)
    cities_with_country = sum(1 for m in data['members'] if 'country' in m and m['country'] is not None)
    cities_with_country_name = sum(1 for m in data['members'] if 'country_name' in m and m['country_name'] is not None)
    
    # Print statistics
    print(f"Total cities: {total_cities}")
    print(f"Cities with wikidata name: {cities_with_name}")
    print(f"Cities with coordinates: {cities_with_coords}")
    print(f"Cities with population: {cities_with_population}")
    print(f"Cities with country ID: {cities_with_country}")
    print(f"Cities with country name: {cities_with_country_name}")

if __name__ == "__main__":
    main()
