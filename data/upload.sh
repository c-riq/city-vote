#!/bin/bash
set -x
trap "exit" INT

aws_profile=rix-admin-chris
s3_bucket=city-vote-data

echo Profile: $aws_profile
echo S3_Bucket: $s3_bucket

if [ -z "$aws_profile" ]; then
  echo "AWS_PROFILE not found"
  exit 1
fi
if [ -z "$s3_bucket" ]; then
  echo "S3_BUCKET not found"
  exit 1
fi

export AWS_PROFILE=$aws_profile

# Validate AWS credentials
echo "Validating AWS credentials..."
if ! aws sts get-caller-identity &>/dev/null; then
    echo "ERROR: AWS credentials are invalid or expired. Please refresh your credentials."
    exit 1
fi

# Check if required files exist
if [ ! -f "cities/cities.json" ]; then
    echo "cities/cities.json not found"
    exit 1
fi

if [ ! -f "auth/auth.json" ]; then
    echo "auth/auth.json not found"
    exit 1
fi

# Upload files to S3
echo "Uploading cities.json..."
if ! aws s3 cp cities/cities.json s3://$s3_bucket/cities/cities.json --cache-control max-age=300,public; then
    echo "ERROR: Failed to upload cities.json"
    exit 1
fi

echo "Uploading auth.json..."
if ! aws s3 cp auth/auth.json s3://$s3_bucket/auth/auth.json --cache-control max-age=300,public; then
    echo "ERROR: Failed to upload auth.json"
    exit 1
fi

echo "Upload complete!" 