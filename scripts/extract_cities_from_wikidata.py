# Script to extract cities and municipalities from Wikidata dump
# Based on the original extract_city_domains_from_wikidata_dump.py

import gzip
import json
import pandas as pd
import pydash
import os

# Path to the Wikidata dump file
wikidata_dump_path = '/Volumes/backup_primary/projects/2023/data_20221022/wikidata/wikidata-20220103-all.json.gz'
# Path to the city subclasses JSON file
city_subclasses_path = './city-subclasses.json'
# Output directory and file
output_dir = 'data/cities'
output_file = os.path.join(output_dir, 'extracted_cities.json')

# Ensure output directory exists
os.makedirs(output_dir, exist_ok=True)

def parse_line(filename):
    """Parse each line of the gzipped JSON file."""
    with gzip.open(filename, 'rt') as f:
        f.read(2)  # skip first two bytes: "{\n"
        for line in f:
            try:
                yield json.loads(line.rstrip(',\n'))
            except json.decoder.JSONDecodeError:
                continue

def load_city_subclasses():
    """Load city and municipality subclasses from the JSON file."""
    print("Loading city and municipality subclasses...")
    with open(city_subclasses_path, 'r', encoding='utf-8') as f:
        subclasses = json.load(f)
    
    # Create a dictionary mapping subclass IDs to their ancestor class
    subclass_map = {}
    for item in subclasses:
        subclass_id = item['citySubclassId']
        ancestor_id = item['ancestorClassId']
        ancestor_label = item['ancestorClassLabel']
        subclass_map[subclass_id] = {
            'ancestorId': ancestor_id,
            'ancestorLabel': ancestor_label
        }
    
    print(f"Loaded {len(subclass_map)} city and municipality subclasses")
    return subclass_map

def extract_cities(city_subclasses):
    """Extract cities and municipalities based on the provided subclasses."""
    print("Extracting cities and municipalities from Wikidata dump...")
    
    # Initialize counters and data structures
    i = 0
    cities = []
    
    # Process each record in the Wikidata dump
    for record in parse_line(wikidata_dump_path):
        # Check if the record has instance of (P31) and has an English label
        if pydash.has(record, 'claims.P31') and pydash.get(record, 'labels.en.value'):
            for p31 in pydash.get(record, 'claims.P31'):
                # Check if it's one of our target city or municipality types
                city_type_id = pydash.get(p31, 'mainsnak.datavalue.value.id')
                if city_type_id in city_subclasses:
                    # Extract required information
                    city_wikidata_id = pydash.get(record, 'id')
                    city_label_english = pydash.get(record, 'labels.en.value')
                    country_wikidata_id = ''
                    ancestor_type = city_subclasses[city_type_id]['ancestorLabel']
                    
                    # Extract country ID if available (P17 property)
                    if pydash.has(record, 'claims.P17'):
                        country_wikidata_id = pydash.get(record, 'claims.P17[0].mainsnak.datavalue.value.id')
                    
                    # Add to cities list
                    city_data = {
                        "cityWikidataId": city_wikidata_id,
                        "cityLabelEnglish": city_label_english,
                        "countryWikidataId": country_wikidata_id,
                        "ancestorType": ancestor_type
                    }
                    cities.append(city_data)
                    
                    # Print progress
                    i += 1
                    if i % 100 == 0:
                        break
                        print(f"Processed {i} cities/municipalities...")
                    
                    # Save intermediate results every 5000 cities
                    if i % 5000 == 0:
                        save_results(cities, f"{output_dir}/cities_intermediate_{i}.json")
                    
                    break  # Only add once if it's a city/municipality
    
    return cities

def save_results(cities, filename):
    """Save the extracted cities to a JSON file."""
    result = {
        "header": ["cityWikidataId", "cityLabelEnglish", "countryWikidataId", "ancestorType"],
        "cities": [[city["cityWikidataId"], city["cityLabelEnglish"], city["countryWikidataId"], city["ancestorType"]] for city in cities]
    }
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

def main():
    """Main function to extract cities and municipalities from Wikidata dump."""
    # Load city and municipality subclasses
    city_subclasses = load_city_subclasses()
    
    # Extract cities and municipalities
    cities = extract_cities(city_subclasses)
    
    # Save final results
    save_results(cities, output_file)
    
    # Also create a CSV version
    df = pd.DataFrame(cities)
    csv_output = output_file.replace('.json', '.csv')
    df.to_csv(csv_output, index=False)
    
    print(f"Extraction complete! Found {len(cities)} cities and municipalities.")
    print(f"Results saved to {output_file} and {csv_output}")

if __name__ == "__main__":
    main()
