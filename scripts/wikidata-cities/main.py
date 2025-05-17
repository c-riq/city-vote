#!/usr/bin/env python3
import os
import time
import multiprocessing
import sys
import pathlib

# Add the parent directory to sys.path to allow imports
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from parser import load_city_subclasses
from extractor import process_lines

# Configuration
SCRIPT_DIR = pathlib.Path(__file__).parent
WIKIDATA_DUMP_PATH = '/Users/c/Desktop/project/data_20221022/wikidata/wikidata-20220103-all.json.gz'
CITY_SUBCLASSES_PATH = str(SCRIPT_DIR / 'city-subclasses.json')
OUTPUT_DIR = str(SCRIPT_DIR / 'data/cities')

def main():
    """Extract cities and municipalities from Wikidata dump."""
    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Number of processes to use
    num_processes = 8
    
    # Number of lines to skip at the beginning
    skip_lines = 0
    
    # Maximum number of lines to process (None for no limit)
    max_lines = 1000000
    
    # Load city and municipality subclasses
    city_subclasses = load_city_subclasses(CITY_SUBCLASSES_PATH)
    
    # Start timing
    start_time = time.time()
    
    # Create and start processes
    processes = []
    
    for i in range(num_processes):
        p = multiprocessing.Process(
            target=process_lines,
            args=(i, WIKIDATA_DUMP_PATH, city_subclasses, OUTPUT_DIR, skip_lines, num_processes, max_lines)
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
    print(f"Results saved to {OUTPUT_DIR}/cities_process_*_final.json")

if __name__ == "__main__":
    # Add freeze_support for Windows compatibility
    multiprocessing.freeze_support()
    main()