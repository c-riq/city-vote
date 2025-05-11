set -x
trap "exit" INT

aws_profile=rix-admin-chris
s3_bucket=city-vote-com
cf_id=E99HKWOVERB2D

echo Profile: $aws_profile
echo S3_Bucket: $s3_bucket
echo CloudFront Distribution: $cf_id

if [ -z "$aws_profile" ]; then
  echo AWS_PROFILE not found
  exit
fi
if [ -z "$s3_bucket" ]; then
  echo S3_BUCKET not found
  exit
fi

export AWS_PROFILE=$aws_profile

# Build the project
echo "Building the project..."
npm run build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "Build failed"
    exit 1
fi

# Check if index.html exists
if [ ! -f "dist/index.html" ]; then
    echo "dist/index.html not found"
    exit 1
fi

# Copy about.html to dist directory
echo "Copying about.html to dist directory..."
cp about.html dist/

# Sync all files with minimal cache duration
echo Synching Build Folder: $s3_bucket...
aws s3 sync dist/ s3://$s3_bucket --delete --exclude "**/.DS_Store" --cache-control "max-age=60,no-cache,must-revalidate,public"

# Invalidate CloudFront cache if distribution ID is provided
if [ ! -z "$cf_id" ]; then
    echo Invalidating cloudfront cache
    aws cloudfront create-invalidation --distribution-id $cf_id --paths "/*" --no-cli-pager
fi
