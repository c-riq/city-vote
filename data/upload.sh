#!/bin/bash
set -x
trap "exit" INT

# Check for dev argument
aws_profile=rix-admin-chris
s3_bucket=city-vote-data

# Append -dev to bucket name if first argument is "dev"
if [ "$1" = "dev" ]; then
  s3_bucket="${s3_bucket}-dev"
fi

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

# Set the upload directory
upload_dir="city-vote-data"

# If dev mode, use city-vote-data-dev directory
if [ "$1" = "dev" ]; then
    upload_dir="city-vote-data-dev"
fi

# Check if directory exists
if [ ! -d "$upload_dir" ]; then
    echo "$upload_dir directory not found"
    exit 1
fi

# Upload all files from the directory to S3
echo "Uploading all files from $upload_dir..."
if ! aws s3 sync "$upload_dir/" s3://$s3_bucket/ --cache-control max-age=300,public; then
    echo "ERROR: Failed to upload files from $upload_dir"
    exit 1
fi

echo "Upload complete!"
