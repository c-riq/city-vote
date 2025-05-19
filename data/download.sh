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

# Create directory for the bucket if it doesn't exist
mkdir -p "$s3_bucket"

# Download all contents from S3
echo "Downloading all contents from s3://$s3_bucket..."
if ! aws s3 sync s3://$s3_bucket/ "$s3_bucket/"; then
    echo "ERROR: Failed to download contents from S3 bucket"
    exit 1
fi

echo "Download complete!"
