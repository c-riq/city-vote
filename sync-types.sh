#!/bin/bash

# Ensure the script exits on any error
set -e

# Define paths
SOURCE_PATH="serverless/vote/src/types.ts"
DEST_PATH="frontend/src/voteBackendTypes.ts"

# Check if source file exists
if [ ! -f "$SOURCE_PATH" ]; then
    echo "Error: Source file $SOURCE_PATH not found"
    exit 1
fi

# Create destination directory if it doesn't exist
mkdir -p "$(dirname "$DEST_PATH")"

# Copy the file
cp "$SOURCE_PATH" "$DEST_PATH"

echo "Successfully synced types from $SOURCE_PATH to $DEST_PATH" 