# City Data Extraction Scripts

This directory contains scripts for extracting city data from various sources.

## Extract Cities from Wikidata

The `extract_cities_from_wikidata.py` script extracts cities and big cities from a Wikidata dump file. It produces a JSON file with the following structure:

```json
{
  "header": ["cityWikidataId", "cityLabelEnglish", "countryWikidataId"],
  "cities": [
    ["Q1353", "Delhi", "Q668"],
    ["Q8686", "Shanghai", "Q148"],
    ...
  ]
}
```

### Setup and Usage

1. Make sure you have Python 3 installed on your system.

2. Set up the virtual environment (from the project root directory):

```bash
# Create the virtual environment
python3 -m venv .venv

# On macOS/Linux
source .venv/bin/activate

# On Windows
.venv\Scripts\activate
```

3. Install the required dependencies:

```bash
pip install -r requirements.txt
```

4. Run the script:

```bash
# Navigate to the scripts directory
cd scripts

# Run the script
python extract_cities_from_wikidata.py
```

The script will:
- Extract cities (Q515) and big cities (Q1549591) from the Wikidata dump
- Save the results to `data/cities/extracted_cities.json` and `data/cities/extracted_cities.csv`
- Display progress information during execution
- Save intermediate results every 5000 cities

### Configuration

You can modify the following variables in the script to customize its behavior:

- `wikidata_dump_path`: Path to the Wikidata dump file
- `output_dir`: Directory where the output files will be saved
- `output_file`: Name of the output JSON file
