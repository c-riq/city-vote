# Script to extract cities and municipalities from Wikidata dump
# Based on the original extract_city_domains_from_wikidata_dump.py

import gzip
import json
import pandas as pd
import pydash
import os
import time
import multiprocessing
import sys

# Path to the Wikidata dump file
wikidata_dump_path = '/Users/c/Desktop/project/data_20221022/wikidata/wikidata-20220103-all.json.gz'
# Path to the city subclasses JSON file
city_subclasses_path = './city-subclasses.json'
# Output directory
output_dir = 'data/cities'

# Ensure output directory exists
os.makedirs(output_dir, exist_ok=True)

def load_city_subclasses():
    """Load city and municipality subclasses from the JSON file."""
    print("Loading city subclasses...")
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
    
    print(f"Loaded {len(subclass_map)} city subclasses")
    return subclass_map

def save_results(cities, filename):
    """Save the extracted cities to a JSON file."""
    result = {
        "header": ["cityWikidataId", "cityLabelEnglish", "countryWikidataId", "ancestorType", "population", "populationDate", "coordinates", "officialWebsite"],
        "cities": [[
            city["cityWikidataId"], 
            city["cityLabelEnglish"], 
            city["countryWikidataId"], 
            city["ancestorType"],
            city["population"],
            city["populationDate"],
            city["coordinates"],
            city["officialWebsite"]
        ] for city in cities]
    }
    
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

def process_lines(process_id, city_subclasses, skip_lines, num_processes=4, max_lines=None):
    """Process lines from the file based on modulo of line number.
    
    Args:
        process_id: ID of the process (0-3)
        city_subclasses: Dictionary of city subclasses
        skip_lines: Number of lines to skip at the beginning
        num_processes: Total number of processes
        max_lines: Maximum number of lines to process (None for no limit)
    """
    print(f"Process {process_id} (PID {os.getpid()}): Starting processing lines where line_number % {num_processes} == {process_id}")
    
    # Initialize counters and data structures
    cities = []
    lines_read = 0
    lines_processed = 0
    save_interval = 1000  # Save results every 1000 cities found
    
    try:
        with gzip.open(wikidata_dump_path, 'rt') as f:
            # Skip the first two bytes: "{\n"
            f.read(2)
            
            # Skip the initial lines that all processes should skip
            if skip_lines > 0:
                print(f"Process {process_id}: Skipping first {skip_lines:,} lines...")
                for i in range(skip_lines):
                    f.readline()
                    if i % 1_000_000 == 0 and i > 0:
                        print(f"Process {process_id}: Skipped {i:,} lines so far...")
                print(f"Process {process_id}: Finished skipping initial {skip_lines:,} lines")
            
            # Process lines based on modulo
            while True:
                line = f.readline()
                if not line:  # End of file
                    break
                
                lines_read += 1
                
                # Check if we've reached the maximum number of lines
                if max_lines is not None and lines_read >= max_lines:
                    print(f"Process {process_id}: Reached maximum of {max_lines:,} lines")
                    break
                
                # Only process lines where line_number % num_processes == process_id
                if lines_read % num_processes != process_id:
                    continue
                
                # Update progress occasionally
                if lines_read % 1_000_000 == 0:
                    print(f"Process {process_id}: Read {lines_read:,} lines, processed {lines_processed:,}")
                
                try:
                    record = json.loads(line.rstrip(',\n'))
                    lines_processed += 1
                    
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
                                
                                # Extract population if available (P1082 property)
                                population = None
                                population_date = None
                                if pydash.has(record, 'claims.P1082'):
                                    population_claim = pydash.get(record, 'claims.P1082[0]')
                                    if pydash.has(population_claim, 'mainsnak.datavalue.value.amount'):
                                        # Population values in Wikidata are prefixed with '+' and may include precision
                                        population_str = pydash.get(population_claim, 'mainsnak.datavalue.value.amount')
                                        try:
                                            # Remove '+' prefix and convert to integer
                                            population = int(population_str.lstrip('+'))
                                            
                                            # Try to extract the point in time qualifier (P585) for population date
                                            if pydash.has(population_claim, 'qualifiers.P585'):
                                                date_qualifier = pydash.get(population_claim, 'qualifiers.P585[0]')
                                                if pydash.has(date_qualifier, 'datavalue.value.time'):
                                                    # Wikidata time format is like "+2019-00-00T00:00:00Z"
                                                    time_str = pydash.get(date_qualifier, 'datavalue.value.time')
                                                    # Extract just the year or full date as needed
                                                    if time_str.startswith('+'):
                                                        time_str = time_str[1:]  # Remove leading '+'
                                                    # Extract date part (before T)
                                                    if 'T' in time_str:
                                                        date_part = time_str.split('T')[0]
                                                        # Handle cases with month/day as 00
                                                        if date_part.endswith('-00-00'):
                                                            population_date = date_part.split('-')[0]  # Just the year
                                                        else:
                                                            population_date = date_part  # Full date
                                        except ValueError:
                                            population = None
                                
                                # Extract coordinates if available (P625 property)
                                coordinates = None
                                if pydash.has(record, 'claims.P625'):
                                    coord_claim = pydash.get(record, 'claims.P625[0]')
                                    if pydash.has(coord_claim, 'mainsnak.datavalue.value'):
                                        coord_value = pydash.get(coord_claim, 'mainsnak.datavalue.value')
                                        latitude = pydash.get(coord_value, 'latitude')
                                        longitude = pydash.get(coord_value, 'longitude')
                                        if latitude is not None and longitude is not None:
                                            coordinates = {
                                                "latitude": latitude,
                                                "longitude": longitude
                                            }
                                
                                # Extract official website if available (P856 property)
                                official_website = None
                                if pydash.has(record, 'claims.P856'):
                                    website_claim = pydash.get(record, 'claims.P856[0]')
                                    if pydash.has(website_claim, 'mainsnak.datavalue.value'):
                                        official_website = pydash.get(website_claim, 'mainsnak.datavalue.value')
                                
                                # Add to cities list
                                city_data = {
                                    "cityWikidataId": city_wikidata_id,
                                    "cityLabelEnglish": city_label_english,
                                    "countryWikidataId": country_wikidata_id,
                                    "ancestorType": ancestor_type,
                                    "population": population,
                                    "populationDate": population_date,
                                    "coordinates": coordinates,
                                    "officialWebsite": official_website
                                }
                                cities.append(city_data)
                                
                                # Save intermediate results periodically
                                if len(cities) % save_interval == 0:
                                    output_file = f"{output_dir}/cities_process_{process_id}_{len(cities)}.json"
                                    save_results(cities, output_file)
                                    print(f"Process {process_id}: Saved {len(cities)} cities to {output_file}")
                                
                                break  # Only add once if it's a city/municipality
                except json.decoder.JSONDecodeError:
                    continue
    
    except Exception as e:
        print(f"Process {process_id}: Error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # Save final results for this process
    if cities:
        output_file = f"{output_dir}/cities_process_{process_id}_final.json"
        save_results(cities, output_file)
        print(f"Process {process_id}: Completed. Found {len(cities)} cities. Saved to {output_file}")
    else:
        print(f"Process {process_id}: Completed. No cities found.")
    
    return len(cities)

def main():
    """Main function to extract cities and municipalities from Wikidata dump."""
    # Number of processes to use
    num_processes = 4
    
    # Number of lines to skip at the beginning
    skip_lines = 0
    
    # Maximum number of lines to process (for testing)
    max_lines = 100000  # Process only 100k lines for testing
    
    # Load city and municipality subclasses (shared by all processes)
    city_subclasses = load_city_subclasses()
    
    # Start timing
    start_time = time.time()
    
    # Create and start processes
    processes = []
    
    # Each process will handle lines where line_number % num_processes == process_id
    for i in range(num_processes):
        p = multiprocessing.Process(
            target=process_lines,
            args=(i, city_subclasses, skip_lines, num_processes, max_lines)
        )
        processes.append(p)
        p.start()
        print(f"Started process {i} (PID {p.pid})")
    
    # Wait for all processes to complete
    for p in processes:
        p.join()
    
    # End timing
    end_time = time.time()
    print(f"All processes completed in {end_time - start_time:.2f} seconds")
    print(f"Results saved to {output_dir}/cities_process_*_final.json")

if __name__ == "__main__":
    # Add freeze_support for Windows compatibility
    multiprocessing.freeze_support()
    main()
