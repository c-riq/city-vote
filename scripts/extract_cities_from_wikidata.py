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
import datetime
import re
from dateutil import parser as date_parser

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
    
    # Create a dictionary mapping subclass IDs to their ancestor class and subclass label
    subclass_map = {}
    for item in subclasses:
        subclass_id = item['citySubclassId']
        ancestor_id = item['ancestorClassId']
        ancestor_label = item['ancestorClassLabel']
        subclass_label = item['citySubclassLabel']
        subclass_map[subclass_id] = {
            'ancestorId': ancestor_id,
            'ancestorLabel': ancestor_label,
            'subclassLabel': subclass_label
        }
    print(f"Loaded {len(subclass_map)} city subclasses")
    return subclass_map

def parse_wikidata_date(time_str):
    """
    Parse a Wikidata time string into a normalized date format for proper comparison.
    
    Args:
        time_str: Wikidata time string (e.g., "+2019-00-00T00:00:00Z")
        
    Returns:
        tuple: (datetime object or None, original date string)
    """
    if not time_str:
        return None, None
    
    # Remove leading + if present
    if time_str.startswith('+'):
        time_str = time_str[1:]
    
    # Extract date part (before T)
    if 'T' in time_str:
        date_part = time_str.split('T')[0]
    else:
        date_part = time_str
    
    # Handle partial dates
    if '-00-00' in date_part:  # Year only
        year = int(date_part.split('-')[0])
        # Use middle of the year for sorting
        parsed_date = datetime.datetime(year, 7, 1)
        return parsed_date, str(year)
    elif re.match(r'\d{4}-\d{2}-00', date_part):  # Year and month
        year, month = map(int, date_part.split('-')[:2])
        # Use middle of the month for sorting
        parsed_date = datetime.datetime(year, month, 15)
        return parsed_date, f"{year}-{month:02d}"
    else:  # Full date or other format
        try:
            parsed_date = date_parser.parse(date_part)
            return parsed_date, date_part
        except (ValueError, TypeError):
            # If parsing fails, return None but keep original string
            return None, date_part


def save_results(cities, filename):
    """Save the extracted cities to a JSON file."""
    result = {
        "header": ["cityWikidataId", "cityLabelEnglish", "countryWikidataId", "ancestorType", "classLabel", "population", "populationDate", "latitude", "longitude", "officialWebsite", "socialMedia"],
        "cities": [[
            city["cityWikidataId"],
            city["cityLabelEnglish"],
            city["countryWikidataId"],
            city["ancestorType"],
            city["classLabel"],
            city["population"],
            city["populationDate"],
            city["latitude"],
            city["longitude"],
            city["officialWebsite"],
            city["socialMedia"]
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
                        # Find all matching city types
                        matching_city_types = []
                        for p31 in pydash.get(record, 'claims.P31'):
                            city_type_id = pydash.get(p31, 'mainsnak.datavalue.value.id')
                            if city_type_id in city_subclasses:
                                matching_city_types.append({
                                    'id': city_type_id,
                                    'ancestor_label': city_subclasses[city_type_id]['ancestorLabel'],
                                    'subclass_label': city_subclasses[city_type_id]['subclassLabel']
                                })
                        
                        # If we found matching city types, use the most specific one
                        # Preference order: city > municipality > other types
                        if matching_city_types:
                            # Sort by specificity (city is most specific)
                            def get_type_priority(type_info):
                                label = type_info['ancestor_label'].lower()
                                if 'city' in label:
                                    return 0  # Highest priority
                                elif 'municipality' in label:
                                    return 1  # Second priority
                                else:
                                    return 2  # Lowest priority
                            
                            matching_city_types.sort(key=get_type_priority)
                            best_type = matching_city_types[0]
                            
                            # Extract required information
                            city_wikidata_id = pydash.get(record, 'id')
                            city_label_english = pydash.get(record, 'labels.en.value')
                            country_wikidata_id = ''
                            ancestor_type = best_type['ancestor_label']
                            class_label = best_type['subclass_label']
                            
                            # Extract country ID if available (P17 property)
                            if pydash.has(record, 'claims.P17'):
                                country_wikidata_id = pydash.get(record, 'claims.P17[0].mainsnak.datavalue.value.id')
                            
                            # Extract population if available (P1082 property)
                            population = None
                            population_date = None
                            if pydash.has(record, 'claims.P1082'):
                                # Get all population claims and sort by date (newest first)
                                population_claims = pydash.get(record, 'claims.P1082', [])
                                valid_population_data = []
                                
                                for pop_claim in population_claims:
                                    if pydash.has(pop_claim, 'mainsnak.datavalue.value.amount'):
                                        # Population values in Wikidata are prefixed with '+' and may include precision
                                        population_str = pydash.get(pop_claim, 'mainsnak.datavalue.value.amount')
                                        try:
                                            # Remove '+' prefix and convert to integer
                                            pop_value = int(population_str.lstrip('+'))
                                            
                                            # Validate population (reject unrealistic values)
                                            # Max realistic city population ~40 million (greater than any known city)
                                            if pop_value <= 0 or pop_value > 40000000:
                                                continue
                                            
                                            # Extract date
                                            pop_date = None
                                            parsed_date = None
                                            if pydash.has(pop_claim, 'qualifiers.P585'):
                                                date_qualifier = pydash.get(pop_claim, 'qualifiers.P585[0]')
                                                if pydash.has(date_qualifier, 'datavalue.value.time'):
                                                    # Wikidata time format is like "+2019-00-00T00:00:00Z"
                                                    time_str = pydash.get(date_qualifier, 'datavalue.value.time')
                                                    # Parse the date properly
                                                    parsed_date, pop_date = parse_wikidata_date(time_str)
                                            
                                            valid_population_data.append({
                                                'value': pop_value,
                                                'date': pop_date,
                                                'parsed_date': parsed_date
                                            })
                                        except ValueError:
                                            continue
                                
                                # Use the most recent population data if available
                                if valid_population_data:
                                    # Sort by date using parsed datetime objects for proper comparison
                                    sorted_data = sorted(
                                        valid_population_data,
                                        key=lambda x: (x['parsed_date'] is None, x['parsed_date'] or datetime.datetime.min),
                                        reverse=True
                                    )
                                    population = sorted_data[0]['value']
                                    population_date = sorted_data[0]['date']
                            
                            # Extract coordinates if available (P625 property)
                            latitude = None
                            longitude = None
                            if pydash.has(record, 'claims.P625'):
                                coord_claim = pydash.get(record, 'claims.P625[0]')
                                if pydash.has(coord_claim, 'mainsnak.datavalue.value'):
                                    coord_value = pydash.get(coord_claim, 'mainsnak.datavalue.value')
                                    latitude = pydash.get(coord_value, 'latitude')
                                    longitude = pydash.get(coord_value, 'longitude')
                            
                            # Extract official website if available (P856 property)
                            official_website = None
                            if pydash.has(record, 'claims.P856'):
                                website_claim = pydash.get(record, 'claims.P856[0]')
                                if pydash.has(website_claim, 'mainsnak.datavalue.value'):
                                    official_website = pydash.get(website_claim, 'mainsnak.datavalue.value')
                            
                            # Extract social media accounts
                            social_media = {}
                            
                            # Twitter username (P2002)
                            if pydash.has(record, 'claims.P2002'):
                                twitter_claim = pydash.get(record, 'claims.P2002[0]')
                                if pydash.has(twitter_claim, 'mainsnak.datavalue.value'):
                                    twitter_username = pydash.get(twitter_claim, 'mainsnak.datavalue.value')
                                    social_media['twitter'] = twitter_username
                            
                            # Facebook ID (P2013)
                            if pydash.has(record, 'claims.P2013'):
                                facebook_claim = pydash.get(record, 'claims.P2013[0]')
                                if pydash.has(facebook_claim, 'mainsnak.datavalue.value'):
                                    facebook_id = pydash.get(facebook_claim, 'mainsnak.datavalue.value')
                                    social_media['facebook'] = facebook_id
                            
                            # Instagram username (P2003)
                            if pydash.has(record, 'claims.P2003'):
                                instagram_claim = pydash.get(record, 'claims.P2003[0]')
                                if pydash.has(instagram_claim, 'mainsnak.datavalue.value'):
                                    instagram_username = pydash.get(instagram_claim, 'mainsnak.datavalue.value')
                                    social_media['instagram'] = instagram_username
                            
                            # YouTube channel ID (P2397)
                            if pydash.has(record, 'claims.P2397'):
                                youtube_claim = pydash.get(record, 'claims.P2397[0]')
                                if pydash.has(youtube_claim, 'mainsnak.datavalue.value'):
                                    youtube_id = pydash.get(youtube_claim, 'mainsnak.datavalue.value')
                                    social_media['youtube'] = youtube_id
                            
                            # LinkedIn company ID (P4264)
                            if pydash.has(record, 'claims.P4264'):
                                linkedin_claim = pydash.get(record, 'claims.P4264[0]')
                                if pydash.has(linkedin_claim, 'mainsnak.datavalue.value'):
                                    linkedin_id = pydash.get(linkedin_claim, 'mainsnak.datavalue.value')
                                    social_media['linkedin'] = linkedin_id
                            
                            # Add to cities list
                            city_data = {
                                "cityWikidataId": city_wikidata_id,
                                "cityLabelEnglish": city_label_english,
                                "countryWikidataId": country_wikidata_id,
                                "ancestorType": ancestor_type,
                                "classLabel": class_label,
                                "population": population,
                                "populationDate": population_date,
                                "latitude": latitude,
                                "longitude": longitude,
                                "officialWebsite": official_website,
                                "socialMedia": social_media if social_media else None
                            }
                            cities.append(city_data)
                            
                            # Save intermediate results periodically
                            if len(cities) % save_interval == 0:
                                output_file = f"{output_dir}/cities_process_{process_id}_{len(cities)}.json"
                                save_results(cities, output_file)
                                print(f"Process {process_id}: Saved {len(cities)} cities to {output_file}")
                            
                            # Process all entities (removed break statement that was causing early exit)
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
    num_processes = 8
    
    # Number of lines to skip at the beginning
    skip_lines = 0
    
    # Maximum number of lines to process (None for no limit)
    max_lines = 10_000 # Process the entire dump
    
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
