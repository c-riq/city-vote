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

# TODO: Add state for US cities

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
                            
                            # Skip cities that have been replaced by something else (P1366)
                            if pydash.has(record, 'claims.P1366'):
                                city_id = pydash.get(record, 'id')
                                city_name = pydash.get(record, 'labels.en.value')
                                replaced_by = pydash.get(record, 'claims.P1366[0].mainsnak.datavalue.value.id', 'unknown')
                                print(f"Process {process_id}: Skipping city {city_id} ({city_name}) - replaced by {replaced_by}")
                                continue
                            
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
    ancestor_type = best_type['ancestor_label']
    class_label = best_type['subclass_label']
    
    # Extract country ID and date
    country_wikidata_id, country_date = extract_country(record)
    
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
    
    # Extract mayor data
    mayor_wikidata_id = extract_mayor_data(record)
    
    # Extract sister cities
    sister_cities = extract_sister_cities(record)
    
    return {
        "cityWikidataId": city_wikidata_id,
        "cityLabelEnglish": city_label_english,
        "countryWikidataId": country_wikidata_id,
        "countryDate": country_date,
        "ancestorType": ancestor_type,
        "classLabel": class_label,
        "population": population,
        "populationDate": population_date,
        "latitude": latitude,
        "longitude": longitude,
        "officialWebsite": official_website,
        "socialMedia": social_media if social_media else None,
        "mayorWikidataId": mayor_wikidata_id,
        "sisterCities": sister_cities if sister_cities else None
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
                            try:
                                time_str = pydash.get(date_qualifier, 'datavalue.value.time')
                                parsed_date, pop_date = parse_wikidata_date(time_str)
                            except Exception as e:
                                print(f"Error parsing population date: {str(e)}")
                                parsed_date, pop_date = None, None
                    
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

def extract_country(record):
    """Extract country and date from a Wikidata record."""
    country_wikidata_id = ''
    country_date = None
    
    if pydash.has(record, 'claims.P17'):
        country_claims = pydash.get(record, 'claims.P17', [])
        valid_country_data = []
        
        for country_claim in country_claims:
            if pydash.has(country_claim, 'mainsnak.datavalue.value.id'):
                country_id = pydash.get(country_claim, 'mainsnak.datavalue.value.id')
                
                # Extract date
                parsed_date = None
                country_date_str = None
                if pydash.has(country_claim, 'qualifiers.P585'):
                    date_qualifier = pydash.get(country_claim, 'qualifiers.P585[0]')
                    if pydash.has(date_qualifier, 'datavalue.value.time'):
                        try:
                            time_str = pydash.get(date_qualifier, 'datavalue.value.time')
                            parsed_date, country_date_str = parse_wikidata_date(time_str)
                        except Exception as e:
                            print(f"Error parsing country date: {str(e)}")
                            parsed_date, country_date_str = None, None
                
                # Check for preferred rank
                rank = pydash.get(country_claim, 'rank', 'normal')
                is_preferred = (rank == 'preferred')
                
                valid_country_data.append({
                    'id': country_id,
                    'date': country_date_str,
                    'parsed_date': parsed_date,
                    'is_preferred': is_preferred
                })
        
        if valid_country_data:
            # First check for preferred rank
            preferred_countries = [c for c in valid_country_data if c['is_preferred']]
            if preferred_countries:
                # If there are multiple preferred countries, sort by date
                if len(preferred_countries) > 1:
                    sorted_data = sorted(
                        preferred_countries,
                        key=lambda x: (x['parsed_date'] is None, x['parsed_date'] or datetime.datetime.min),
                        reverse=True
                    )
                    country_wikidata_id = sorted_data[0]['id']
                    country_date = sorted_data[0]['date']
                else:
                    country_wikidata_id = preferred_countries[0]['id']
                    country_date = preferred_countries[0]['date']
            else:
                # Sort by date using parsed datetime objects
                sorted_data = sorted(
                    valid_country_data,
                    key=lambda x: (x['parsed_date'] is None, x['parsed_date'] or datetime.datetime.min),
                    reverse=True
                )
                country_wikidata_id = sorted_data[0]['id']
                country_date = sorted_data[0]['date']
    
    return country_wikidata_id, country_date

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
    
    # Bluesky handle (P8605)
    if pydash.has(record, 'claims.P8605'):
        bluesky_claim = pydash.get(record, 'claims.P8605[0]')
        if pydash.has(bluesky_claim, 'mainsnak.datavalue.value'):
            bluesky_handle = pydash.get(bluesky_claim, 'mainsnak.datavalue.value')
            social_media['bluesky'] = bluesky_handle
    
    # Mastodon address (P4033)
    if pydash.has(record, 'claims.P4033'):
        mastodon_claim = pydash.get(record, 'claims.P4033[0]')
        if pydash.has(mastodon_claim, 'mainsnak.datavalue.value'):
            mastodon_address = pydash.get(mastodon_claim, 'mainsnak.datavalue.value')
            social_media['mastodon'] = mastodon_address
    
    # TikTok username (P7085)
    if pydash.has(record, 'claims.P7085'):
        tiktok_claim = pydash.get(record, 'claims.P7085[0]')
        if pydash.has(tiktok_claim, 'mainsnak.datavalue.value'):
            tiktok_username = pydash.get(tiktok_claim, 'mainsnak.datavalue.value')
            social_media['tiktok'] = tiktok_username
    
    # Threads profile (P10566)
    if pydash.has(record, 'claims.P10566'):
        threads_claim = pydash.get(record, 'claims.P10566[0]')
        if pydash.has(threads_claim, 'mainsnak.datavalue.value'):
            threads_profile = pydash.get(threads_claim, 'mainsnak.datavalue.value')
            social_media['threads'] = threads_profile
    
    return social_media

def extract_mayor_data(record):
    """Extract current mayor Wikidata ID from a Wikidata record."""
    mayor_wikidata_id = None
    
    # Head of government (P6) - commonly used for mayors
    if pydash.has(record, 'claims.P6'):
        mayor_claims = pydash.get(record, 'claims.P6', [])
        valid_mayor_data = []
        
        for mayor_claim in mayor_claims:
            if pydash.has(mayor_claim, 'mainsnak.datavalue.value.id'):
                mayor_id = pydash.get(mayor_claim, 'mainsnak.datavalue.value.id')
                
                # Check if this is a current position (no end date)
                has_end_date = False
                if pydash.has(mayor_claim, 'qualifiers.P582'):  # End date qualifier
                    has_end_date = True
                
                # Check for preferred rank
                rank = pydash.get(mayor_claim, 'rank', 'normal')
                is_preferred = (rank == 'preferred')
                
                # Extract start date for sorting if needed
                start_date = None
                parsed_start_date = None
                if pydash.has(mayor_claim, 'qualifiers.P580'):  # Start date qualifier
                    date_qualifier = pydash.get(mayor_claim, 'qualifiers.P580[0]')
                    if pydash.has(date_qualifier, 'datavalue.value.time'):
                        try:
                            time_str = pydash.get(date_qualifier, 'datavalue.value.time')
                            parsed_start_date, start_date = parse_wikidata_date(time_str)
                        except Exception as e:
                            print(f"Error parsing mayor start date: {str(e)}")
                            parsed_start_date, start_date = None, None
                
                if not has_end_date:  # Only consider current mayors (no end date)
                    valid_mayor_data.append({
                        'id': mayor_id,
                        'start_date': start_date,
                        'parsed_start_date': parsed_start_date,
                        'is_preferred': is_preferred
                    })
        
        if valid_mayor_data:
            # First check for preferred rank
            preferred_mayors = [m for m in valid_mayor_data if m['is_preferred']]
            if preferred_mayors:
                # If there are multiple preferred mayors, sort by start date (most recent first)
                if len(preferred_mayors) > 1:
                    sorted_data = sorted(
                        preferred_mayors,
                        key=lambda x: (x['parsed_start_date'] is None, x['parsed_start_date'] or datetime.datetime.min),
                        reverse=True
                    )
                    mayor_wikidata_id = sorted_data[0]['id']
                else:
                    mayor_wikidata_id = preferred_mayors[0]['id']
            else:
                # Sort by start date (most recent first)
                sorted_data = sorted(
                    valid_mayor_data,
                    key=lambda x: (x['parsed_start_date'] is None, x['parsed_start_date'] or datetime.datetime.min),
                    reverse=True
                )
                mayor_wikidata_id = sorted_data[0]['id']
    
    # If no mayor found with P6, try P1308 (officeholder)
    if not mayor_wikidata_id and pydash.has(record, 'claims.P1308'):
        officeholder_claims = pydash.get(record, 'claims.P1308', [])
        valid_officeholder_data = []
        
        for officeholder_claim in officeholder_claims:
            if pydash.has(officeholder_claim, 'mainsnak.datavalue.value.id'):
                officeholder_id = pydash.get(officeholder_claim, 'mainsnak.datavalue.value.id')
                
                # Check if this is a current position (no end date)
                has_end_date = False
                if pydash.has(officeholder_claim, 'qualifiers.P582'):  # End date qualifier
                    has_end_date = True
                
                # Check for preferred rank
                rank = pydash.get(officeholder_claim, 'rank', 'normal')
                is_preferred = (rank == 'preferred')
                
                # Extract start date for sorting if needed
                start_date = None
                parsed_start_date = None
                if pydash.has(officeholder_claim, 'qualifiers.P580'):  # Start date qualifier
                    date_qualifier = pydash.get(officeholder_claim, 'qualifiers.P580[0]')
                    if pydash.has(date_qualifier, 'datavalue.value.time'):
                        try:
                            time_str = pydash.get(date_qualifier, 'datavalue.value.time')
                            parsed_start_date, start_date = parse_wikidata_date(time_str)
                        except Exception as e:
                            print(f"Error parsing officeholder start date: {str(e)}")
                            parsed_start_date, start_date = None, None
                
                if not has_end_date:  # Only consider current officeholders (no end date)
                    valid_officeholder_data.append({
                        'id': officeholder_id,
                        'start_date': start_date,
                        'parsed_start_date': parsed_start_date,
                        'is_preferred': is_preferred
                    })
        
        if valid_officeholder_data:
            # First check for preferred rank
            preferred_officeholders = [o for o in valid_officeholder_data if o['is_preferred']]
            if preferred_officeholders:
                # If there are multiple preferred officeholders, sort by start date (most recent first)
                if len(preferred_officeholders) > 1:
                    sorted_data = sorted(
                        preferred_officeholders,
                        key=lambda x: (x['parsed_start_date'] is None, x['parsed_start_date'] or datetime.datetime.min),
                        reverse=True
                    )
                    mayor_wikidata_id = sorted_data[0]['id']
                else:
                    mayor_wikidata_id = preferred_officeholders[0]['id']
            else:
                # Sort by start date (most recent first)
                sorted_data = sorted(
                    valid_officeholder_data,
                    key=lambda x: (x['parsed_start_date'] is None, x['parsed_start_date'] or datetime.datetime.min),
                    reverse=True
                )
                mayor_wikidata_id = sorted_data[0]['id']
    
    return mayor_wikidata_id

def extract_sister_cities(record):
    """Extract list of sister cities' Wikidata IDs from a Wikidata record."""
    sister_cities = []
    
    # Twin/sister city (P190)
    if pydash.has(record, 'claims.P190'):
        sister_city_claims = pydash.get(record, 'claims.P190', [])
        
        for sister_city_claim in sister_city_claims:
            if pydash.has(sister_city_claim, 'mainsnak.datavalue.value.id'):
                sister_city_id = pydash.get(sister_city_claim, 'mainsnak.datavalue.value.id')
                
                # Check if this relationship is current (no end date)
                has_end_date = False
                if pydash.has(sister_city_claim, 'qualifiers.P582'):  # End date qualifier
                    has_end_date = True
                
                if not has_end_date:  # Only consider current sister city relationships
                    sister_cities.append(sister_city_id)
    
    return sister_cities
