#!/bin/bash

export AWS_PROFILE="rix-admin-chris"

# Change to the directory containing the function
cd "$(dirname "$0")"

REGION="us-east-1"      # N. Virginia
FUNCTION_NAME="city-vote-autocomplete-city"
ZIP_FILE="function.zip"

# Build the TypeScript code
echo "Building TypeScript..."
npm run build

# Check if required files exist
if [ ! -f "dist/autocomplete.js" ]; then
    echo "Error: dist/autocomplete.js not found in current directory ($(pwd))"
    echo "Build failed"
    exit 1
fi

# Create a temporary directory for the package
TEMP_DIR=$(mktemp -d)
echo "Created temporary directory: $TEMP_DIR"

# Copy function file and dependencies
cp -r dist/* "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"

# Install dependencies
cd "$TEMP_DIR"
npm install --production
cd -

# Create deployment package
rm -f $ZIP_FILE  # Remove any existing zip file
cd "$TEMP_DIR"
zip -r "$OLDPWD/$ZIP_FILE" .
cd -

# Update function code
echo "Updating function $FUNCTION_NAME in $REGION..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://$ZIP_FILE \
    --region $REGION \
    --no-cli-pager

# Clean up
rm -f $ZIP_FILE
rm -rf "$TEMP_DIR"

echo "Deployment complete!"
