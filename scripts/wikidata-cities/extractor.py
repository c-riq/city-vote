import gzip
import json
import pydash
import os
import datetime
import sys
import pathlib

# Add the parent directory to sys.path to allow imports
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from parser import parse_wikidata_date, save_results

def process_lines(process_id, wikidata_dump_path, city_subclasses, output_dir, skip_lines=0, num_processes=4, max_lines=None):
    """Process lines from the Wikidata dump file."""
    print(f"Process {process_id}: Starting processing")
    
    cities = []
    lines_read = 0
    lines_processed = 0
    save_interval = 1000
    
    try:
        with gzip.open(wikidata_dump_path, 'rt') as f:
            f.read(2)  # Skip the first two bytes: "{\n"
            
            if skip_lines > 0:
                for i in range(skip_lines):
                    f.readline()
            
            while True:
                line = f.readline()
                if not line:  # End of file
                    break
                
                lines_read += 1
                
                if max_lines is not None and lines_read >= max_lines:
                    break
                
                if lines_read % num_processes != process_id:
                    continue
                
                if lines_read % 1_000_000 == 0:
                    print(f"Process {process_id}: Read {lines_read:,} lines, processed {lines_processed:,}")
                
                try:
                    record = json.loads(line.rstrip(',\n'))
                    lines_processed += 1
                    
                    if pydash.has(record, 'claims.P31') and pydash.get(record, 'labels.en.value'):
                        matching_city_types = []
                        for p31 in pydash.get(record, 'claims.P31'):
                            city_type_id = pydash.get(p31, 'mainsnak.datavalue.value.id')
                            if city_type_id in city_subclasses:
                                matching_city_types.append({
                                    'id': city_type_id,
                                    'ancestor_label': city_subclasses[city_type_id]['ancestorLabel'],
                                    'subclass_label': city_subclasses[city_type_id]['subclassLabel']
                                })
                        
                        if matching_city_types:
                            # Sort by specificity (city is most specific)
                            def get_type_priority(type_info):
                                label = type_info['ancestor_label'].lower()
                                if 'city' in label:
                                    return 0
                                elif 'municipality' in label:
                                    return 1
                                else:
                                    return 2
                            
                            matching_city_types.sort(key=get_type_priority)
                            best_type = matching_city_types[0]
                            
                            city_data = extract_city_data(record, best_type)
                            cities.append(city_data)
                            
                            if len(cities) % save_interval == 0:
                                output_file = f"{output_dir}/cities_process_{process_id}_{len(cities)}.json"
                                save_results(cities, output_file)
                                print(f"Process {process_id}: Saved {len(cities)} cities")
                
                except json.decoder.JSONDecodeError:
                    continue
    
    except Exception as e:
        print(f"Process {process_id}: Error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    if cities:
        output_file = f"{output_dir}/cities_process_{process_id}_final.json"
        save_results(cities, output_file)
        print(f"Process {process_id}: Completed. Found {len(cities)} cities")
    
    return len(cities)

def extract_city_data(record, best_type):
    """Extract city data from a Wikidata record."""
    city_wikidata_id = pydash.get(record, 'id')
    city_label_english = pydash.get(record, 'labels.en.value')
    country_wikidata_id = ''
    ancestor_type = best_type['ancestor_label']
    class_label = best_type['subclass_label']
    
    # Extract country ID
    if pydash.has(record, 'claims.P17'):
        country_wikidata_id = pydash.get(record, 'claims.P17[0].mainsnak.datavalue.value.id')
    
    # Extract population and date
    population, population_date = extract_population(record)
    
    # Extract coordinates
    latitude, longitude = extract_coordinates(record)
    
    # Extract official website
    official_website = None
    if pydash.has(record, 'claims.P856'):
        website_claim = pydash.get(record, 'claims.P856[0]')
        if pydash.has(website_claim, 'mainsnak.datavalue.value'):
            official_website = pydash.get(website_claim, 'mainsnak.datavalue.value')
    
    # Extract social media accounts
    social_media = extract_social_media(record)
    
    return {
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

def extract_population(record):
    """Extract population and date from a Wikidata record."""
    population = None
    population_date = None
    
    if pydash.has(record, 'claims.P1082'):
        population_claims = pydash.get(record, 'claims.P1082', [])
        valid_population_data = []
        
        for pop_claim in population_claims:
            if pydash.has(pop_claim, 'mainsnak.datavalue.value.amount'):
                population_str = pydash.get(pop_claim, 'mainsnak.datavalue.value.amount')
                try:
                    pop_value = int(population_str.lstrip('+'))
                    
                    # Validate population
                    if pop_value <= 0 or pop_value > 40000000:
                        continue
                    
                    # Extract date
                    parsed_date = None
                    pop_date = None
                    if pydash.has(pop_claim, 'qualifiers.P585'):
                        date_qualifier = pydash.get(pop_claim, 'qualifiers.P585[0]')
                        if pydash.has(date_qualifier, 'datavalue.value.time'):
                            time_str = pydash.get(date_qualifier, 'datavalue.value.time')
                            parsed_date, pop_date = parse_wikidata_date(time_str)
                    
                    valid_population_data.append({
                        'value': pop_value,
                        'date': pop_date,
                        'parsed_date': parsed_date
                    })
                except ValueError:
                    continue
        
        if valid_population_data:
            # Sort by date using parsed datetime objects
            sorted_data = sorted(
                valid_population_data,
                key=lambda x: (x['parsed_date'] is None, x['parsed_date'] or datetime.datetime.min),
                reverse=True
            )
            population = sorted_data[0]['value']
            population_date = sorted_data[0]['date']
    
    return population, population_date

def extract_coordinates(record):
    """Extract coordinates from a Wikidata record."""
    latitude = None
    longitude = None
    
    if pydash.has(record, 'claims.P625'):
        coord_claim = pydash.get(record, 'claims.P625[0]')
        if pydash.has(coord_claim, 'mainsnak.datavalue.value'):
            coord_value = pydash.get(coord_claim, 'mainsnak.datavalue.value')
            latitude = pydash.get(coord_value, 'latitude')
            longitude = pydash.get(coord_value, 'longitude')
    
    return latitude, longitude

def extract_social_media(record):
    """Extract social media accounts from a Wikidata record."""
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
    
    return social_media