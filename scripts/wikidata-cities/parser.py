import re
import datetime
from dateutil import parser as date_parser

def parse_wikidata_date(time_str):
    """Parse a Wikidata time string into a normalized date format."""
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
        parsed_date = datetime.datetime(year, 7, 1)
        return parsed_date, str(year)
    elif re.match(r'\d{4}-\d{2}-00', date_part):  # Year and month
        year, month = map(int, date_part.split('-')[:2])
        parsed_date = datetime.datetime(year, month, 15)
        return parsed_date, f"{year}-{month:02d}"
    else:  # Full date or other format
        try:
            parsed_date = date_parser.parse(date_part)
            return parsed_date, date_part
        except (ValueError, TypeError):
            return None, date_part

def load_city_subclasses(city_subclasses_path):
    """Load city and municipality subclasses from the JSON file."""
    import json
    
    with open(city_subclasses_path, 'r', encoding='utf-8') as f:
        subclasses = json.load(f)
    
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
    
    return subclass_map

def save_results(cities, filename):
    """Save the extracted cities to a JSON file with each record on a single line."""
    import json
    
    header = ["cityWikidataId", "cityLabelEnglish", "countryWikidataId", "countryDate", "ancestorType",
              "classLabel", "population", "populationDate", "latitude", "longitude",
              "officialWebsite", "socialMedia", "mayorWikidataId", "sisterCities"]
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(json.dumps(header, ensure_ascii=False) + '\n')
        
        for city in cities:
            city_record = [
                city["cityWikidataId"],
                city["cityLabelEnglish"],
                city["countryWikidataId"],
                city["countryDate"],
                city["ancestorType"],
                city["classLabel"],
                city["population"],
                city["populationDate"],
                city["latitude"],
                city["longitude"],
                city["officialWebsite"],
                city["socialMedia"],
                city["mayorWikidataId"],
                city["sisterCities"]
            ]
            f.write(json.dumps(city_record, ensure_ascii=False) + '\n')
