# City Deduplication Script

This script identifies and marks duplicate cities in the city-data.csv file based on exact name matches and close geographic proximity.

## Features

- Identifies cities with identical names and very close geographic coordinates
- Determines which city takes precedence based on:
  1. More social media presence (highest priority)
  2. Website existence (medium priority)
  3. Lower QID value (lowest priority)
- Adds two new columns to the CSV file:
  - `supersedes_duplicates`: QIDs of cities that this city supersedes (separated by `|`)
  - `superseded_by`: QID of a city that supersedes this one

## Usage

```bash
# Basic usage with default parameters
./deduplicate_cities.py

# Specify input and output files
./deduplicate_cities.py --input path/to/input.csv --output path/to/output.csv

# Adjust the distance threshold (in kilometers)
./deduplicate_cities.py --distance 10.0
```

## Parameters

- `--input`: Path to the input CSV file (default: serverless/autocomplete/src/city-data.csv)
- `--output`: Path to the output CSV file (default: serverless/autocomplete/src/city-data-deduplicated.csv)
- `--distance`: Maximum distance in kilometers to consider cities as duplicates (default: 5.0)

## Example

```bash
# Run with a smaller distance threshold (2 km)
./deduplicate_cities.py --distance 2.0

# Use a different input file
./deduplicate_cities.py --input data/cities.csv --output data/cities-deduplicated.csv
```

## Requirements

- Python 3.6+
- pandas
- geopy

Install the required packages:

```bash
pip install pandas geopy
```

## Output Statistics

After running the script, it will print statistics about the deduplication process:

```
Deduplication complete:
  - X cities marked as duplicates
  - Y cities supersede others
  - Z total cities in the dataset