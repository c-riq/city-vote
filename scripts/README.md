# City Data Extraction Scripts

This directory contains scripts for extracting city data from various sources.

## Extract Cities from Wikidata

The `extract_cities_from_wikidata.py` script extracts cities from a Wikidata dump file. It produces a JSON file with the following structure:

```json
{
  "header": ["cityWikidataId", "cityLabelEnglish", "countryWikidataId", "ancestorType"],
  "cities": [
    ["Q1353", "Delhi", "Q668", "city"],
    ["Q8686", "Shanghai", "Q148", "city"],
    ["Q1490", "Toronto", "Q16", "municipality"],
    ...
  ]
}
```

### How It Works

The script uses a two-step process:

1. First, it loads city and municipality subclasses from the pre-generated `city-subclasses.json` file
2. Then, it extracts all entities that are instances of any of these city or municipality subclasses

This approach automatically captures all types of cities without needing to hardcode specific city types.

### Setup and Usage

1. Set up the Python virtual environment:

```bash
# Create the virtual environment
python3 -m venv .venv

# Activate it
source .venv/bin/activate  # On macOS/Linux
.venv\Scripts\activate     # On Windows
```

2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

3. Run the script:

```bash
python scripts/extract_cities_from_wikidata.py
```

The script will:
- Load city and municipality subclasses from the pre-generated `city-subclasses.json` file
- Extract all cities and municipalities based on those subclasses
- Save the results to `data/cities/extracted_cities.json` and `data/cities/extracted_cities.csv`
- Display progress information during execution
