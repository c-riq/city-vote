#!/bin/bash

export AWS_PROFILE="rix-admin-chris"

# Change to the directory containing the function
cd "$(dirname "$0")"

# Build the project
echo "Building the project..."
npm run build

# Check if "dev" argument is provided
if [ "$1" == "dev" ]; then
  ENV="dev"
  FUNCTION_NAME="city-vote-unauthenticated-dev"
  ROLE_ARN="arn:aws:iam::152769399840:role/service-role/city-vote-unauthenticated-dev-role-z33gawc2"
  echo "Deploying to DEV environment..."
else
  ENV="prod"
  FUNCTION_NAME="city-vote-unauthenticated"
  ROLE_ARN="arn:aws:iam::152769399840:role/service-role/city-vote-unauthenticated-role-aay5rono"
  echo "Deploying to PRODUCTION environment..."
fi

REGION="us-east-1"      # N. Virginia
ZIP_FILE="function.zip"


# Check if required files exist
if [ ! -f "dist/public.js" ]; then
    echo "Error: dist/public.js not found in current directory ($(pwd))"
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

# Check if zip file was created successfully
if [ ! -f "$ZIP_FILE" ]; then
    echo "Error: Failed to create zip file"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Set environment variables based on deployment environment
ENVIRONMENT_VARIABLES="{\"Variables\":{\"CITY_VOTE_ENV\":\"$ENV\"}}"

# Update existing function or create new one
echo "Updating function $FUNCTION_NAME in $REGION..."
if ! aws lambda get-function --function-name $FUNCTION_NAME --region $REGION --no-cli-pager >/dev/null 2>&1; then
    echo "Creating new function $FUNCTION_NAME in $REGION..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime nodejs22.x \
        --role $ROLE_ARN \
        --handler public.handler \
        --zip-file fileb://$ZIP_FILE \
        --region $REGION \
        --timeout 10 \
        --memory-size 128 \
        --environment "$ENVIRONMENT_VARIABLES" \
        --no-cli-pager
else
    # Update function configuration and wait for completion
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --timeout 10 \
        --memory-size 128 \
        --environment "$ENVIRONMENT_VARIABLES" \
        --region $REGION \
        --no-cli-pager

    # Wait for function to be in stable state
    echo "Waiting for function configuration update to complete..."
    aws lambda wait function-updated-v2 \
        --function-name $FUNCTION_NAME \
        --region $REGION

    # Update function code
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://$ZIP_FILE \
        --region $REGION \
        --no-cli-pager
fi

# Clean up
rm -f $ZIP_FILE
rm -rf "$TEMP_DIR"

echo "Deployment complete!"
