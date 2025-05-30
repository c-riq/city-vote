#!/bin/bash

export AWS_PROFILE="rix-admin-chris"

# Change to the directory containing the function
cd "$(dirname "$0")"

# Check if "dev" argument is provided
if [ "$1" == "dev" ]; then
  ENV="dev"
  FUNCTION_NAME="city-vote-autocomplete-city-dev"
  echo "Deploying to DEV environment..."
else
  ENV="prod"
  FUNCTION_NAME="city-vote-autocomplete-city"
  echo "Deploying to PRODUCTION environment..."
fi

REGION="us-east-1"      # N. Virginia
ZIP_FILE="function.zip"

# Generate split CSV files
echo "Generating split CSV files..."
npm run split

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

# Copy function file, dependencies, and CSV data files
cp -r dist/* "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"

# Copy the original CSV file
cp src/city-data.csv "$TEMP_DIR/"

# Create directories for split CSV files
mkdir -p "$TEMP_DIR/split_by_letter"
mkdir -p "$TEMP_DIR/split_by_qid"

# Copy split CSV files
echo "Copying split CSV files..."
cp -r src/split_by_letter/* "$TEMP_DIR/split_by_letter/"
cp -r src/split_by_qid/* "$TEMP_DIR/split_by_qid/"

# Install dependencies
cd "$TEMP_DIR"
npm install --production
cd -

# Create deployment package
rm -f $ZIP_FILE  # Remove any existing zip file
cd "$TEMP_DIR"
zip -r "$OLDPWD/$ZIP_FILE" .
cd -

# Set environment variables based on deployment environment
ENVIRONMENT_VARIABLES="{\"Variables\":{\"CITY_VOTE_ENV\":\"$ENV\"}}"

# Update function code
echo "Updating function $FUNCTION_NAME in $REGION..."
aws lambda update-function-code \
    --function-name $FUNCTION_NAME \
    --zip-file fileb://$ZIP_FILE \
    --region $REGION \
    --no-cli-pager

# Wait for the function update to complete
echo "Waiting for function update to complete..."
aws lambda wait function-updated \
    --function-name $FUNCTION_NAME \
    --region $REGION

# Set memory to 512 MB and timeout to 15 seconds
echo "Setting memory to 512 MB and timeout to 15 seconds..."
aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --memory-size 512 \
    --timeout 15 \
    --environment "$ENVIRONMENT_VARIABLES" \
    --region $REGION \
    --no-cli-pager

# Clean up
rm -f $ZIP_FILE
rm -rf "$TEMP_DIR"

echo "Deployment complete!"
