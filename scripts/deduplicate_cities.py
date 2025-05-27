#!/usr/bin/env python3
"""
Script to deduplicate cities based on exact name match and close geographic proximity.
Creates a new CSV file with additional columns:
- supersedes_duplicates: QIDs of cities that this city supersedes
- superseded_by: QID of a city that supersedes this one

Criteria for precedence:
1. More social media presence
2. Website existence
3. Lower QID value
"""

import pandas as pd
import json
import os
from geopy.distance import geodesic
import argparse

def parse_coordinates(lat, lon):
    """Parse coordinates from latitude and longitude values."""
    if pd.isna(lat) or pd.isna(lon):
        return None
    try:
        return (float(lat), float(lon))
    except (ValueError, TypeError):
        return None

def parse_social_media(social_media_str):
    """Parse social media from JSON string and count platforms."""
    if pd.isna(social_media_str) or social_media_str == '':
        return 0
    try:
        social_media = json.loads(social_media_str)
        return len(social_media)
    except (json.JSONDecodeError, AttributeError):
        return 0

def has_website(website_str):
    """Check if city has a website."""
    return not pd.isna(website_str) and website_str != ''

def get_qid_number(qid_str):
    """Extract numeric part from QID."""
    if pd.isna(qid_str):
        return float('inf')
    try:
        return int(qid_str.replace('Q', ''))
    except (ValueError, AttributeError):
        return float('inf')

def calculate_city_score(row):
    """Calculate a score for city precedence."""
    score = 0
    
    # More social media presence (highest priority)
    score += parse_social_media(row['socialMedia']) * 100
    
    # Website existence (medium priority)
    if has_website(row['officialWebsite']):
        score += 10
    
    # Lower QID (lowest priority but still a tiebreaker)
    score -= get_qid_number(row['cityWikidataId']) * 0.001
    
    return score

def main():
    parser = argparse.ArgumentParser(description='Deduplicate cities in CSV file.')
    parser.add_argument('--input', default='serverless/autocomplete/src/city-data.csv',
                        help='Input CSV file path')
    parser.add_argument('--output', default='serverless/autocomplete/src/city-data-deduplicated.csv',
                        help='Output CSV file path')
    parser.add_argument('--distance', type=float, default=5.0,
                        help='Maximum distance in km to consider cities as duplicates')
    args = parser.parse_args()
    
    print(f"Loading city data from {args.input}...")
    df = pd.read_csv(args.input)
    
    # Get the socialMedia column if it exists
    has_social_media = 'socialMedia' in df.columns
    
    # If socialMedia exists, temporarily store it
    if has_social_media:
        social_media_data = df['socialMedia'].copy()
        # Drop the socialMedia column to add it back at the end
        df = df.drop(columns=['socialMedia'])
    
    # Create new columns for deduplication results
    df['supersedes_duplicates'] = ''
    df['superseded_by'] = ''
    
    # Add socialMedia back as the last column if it existed
    if has_social_media:
        df['socialMedia'] = social_media_data
    
    # Convert latitude and longitude to numeric values
    df['latitude_num'] = pd.to_numeric(df['latitude'], errors='coerce')
    df['longitude_num'] = pd.to_numeric(df['longitude'], errors='coerce')
    
    # Round latitude and longitude to 2 decimal places
    df['latitude'] = df['latitude_num'].apply(lambda x: round(x, 2) if not pd.isna(x) else None)
    df['longitude'] = df['longitude_num'].apply(lambda x: round(x, 2) if not pd.isna(x) else None)
    
    # Create coordinates tuple for distance calculations
    df['coords_tuple'] = df.apply(
        lambda row: (row['latitude_num'], row['longitude_num'])
        if not pd.isna(row['latitude_num']) and not pd.isna(row['longitude_num'])
        else None,
        axis=1
    )
    
    # Calculate scores for precedence
    df['score'] = df.apply(calculate_city_score, axis=1)
    
    # Group cities by exact name match
    name_groups = df.groupby('cityLabelEnglish')
    
    total_groups = len(name_groups)
    print(f"Processing {total_groups} city name groups...")
    
    # Track processed cities to avoid double-processing
    processed_qids = set()
    
    # Process each group of cities with the same name
    for name, group in name_groups:
        if len(group) == 1:
            continue  # Skip single cities
            
        # Sort by score (descending)
        sorted_group = group.sort_values('score', ascending=False)
        
        # Process each city in the group
        for i, (idx1, city1) in enumerate(sorted_group.iterrows()):
            qid1 = city1['cityWikidataId']
            
            # Skip if already processed as a duplicate
            if qid1 in processed_qids:
                continue
                
            coords1 = city1['coords_tuple']
            if coords1 is None:
                continue
                
            # Cities this one supersedes
            supersedes = []
            
            # Check against other cities in the same name group
            for j, (idx2, city2) in enumerate(sorted_group.iterrows()):
                if i == j:
                    continue  # Skip self
                    
                qid2 = city2['cityWikidataId']
                
                # Skip if already processed
                if qid2 in processed_qids:
                    continue
                    
                coords2 = city2['coords_tuple']
                if coords2 is None:
                    continue
                    
                # Calculate distance between cities
                try:
                    distance = geodesic(coords1, coords2).kilometers
                except (ValueError, TypeError):
                    continue
                    
                # If cities are close enough, mark as duplicate
                if distance <= args.distance:
                    supersedes.append(qid2)
                    df.at[idx2, 'superseded_by'] = qid1
                    processed_qids.add(qid2)
            
            # Update supersedes_duplicates field
            if supersedes:
                df.at[idx1, 'supersedes_duplicates'] = '|'.join(supersedes)
                processed_qids.add(qid1)
    
    # Drop temporary columns
    df = df.drop(columns=['coords_tuple', 'score', 'latitude_num', 'longitude_num'])
    
    # Save to new CSV file
    print(f"Saving deduplicated data to {args.output}...")
    df.to_csv(args.output, index=False)
    
    # Print statistics
    superseded_count = df[df['superseded_by'] != ''].shape[0]
    supersedes_count = df[df['supersedes_duplicates'] != ''].shape[0]
    print(f"Deduplication complete:")
    print(f"  - {superseded_count} cities marked as duplicates")
    print(f"  - {supersedes_count} cities supersede others")
    print(f"  - {df.shape[0]} total cities in the dataset")

if __name__ == "__main__":
    main()
