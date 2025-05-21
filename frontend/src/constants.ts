// Production endpoints
const VOTE_HOST_PROD = "https://3urhqgw6qvoqktkpttvx6gp2la0cpslc.lambda-url.us-east-1.on.aws"
const PUBLIC_API_HOST_PROD = "https://nql4dkqdthgv5emb7o7qyzmq5q0ibwei.lambda-url.us-east-1.on.aws"
const AUTOCOMPLETE_API_HOST_PROD = "https://fn3h2k7se6wbpwa7vgmgd5sui40kfdeo.lambda-url.us-east-1.on.aws"
const PUBLIC_DATA_BUCKET_URL_PROD = "https://city-vote-data-public.s3.amazonaws.com"

// Development endpoints
const VOTE_HOST_DEV = "https://pziu2upkvywjrt3jlgu7ydm5li0ewqqg.lambda-url.us-east-1.on.aws"
const PUBLIC_API_HOST_DEV = "https://njzyamhrcra5ez4nmhxjr4zj2q0igkpk.lambda-url.us-east-1.on.aws"
const AUTOCOMPLETE_API_HOST_DEV = "https://gr5ayb7nuvx4mpuqymzxdj24sa0nrtqz.lambda-url.us-east-1.on.aws"
const PUBLIC_DATA_BUCKET_URL_DEV = "https://city-vote-data-public-dev.s3.amazonaws.com"

// Determine if we're in a local development environment
const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Export the appropriate endpoints based on environment
export const VOTE_HOST = isLocalDev ? VOTE_HOST_DEV : VOTE_HOST_PROD;
export const PUBLIC_API_HOST = isLocalDev ? PUBLIC_API_HOST_DEV : PUBLIC_API_HOST_PROD;
export const AUTOCOMPLETE_API_HOST = isLocalDev ? AUTOCOMPLETE_API_HOST_DEV : AUTOCOMPLETE_API_HOST_PROD;
export const PUBLIC_DATA_BUCKET_URL = isLocalDev ? PUBLIC_DATA_BUCKET_URL_DEV : PUBLIC_DATA_BUCKET_URL_PROD;

// Also export the dev endpoints directly for cases where they might be needed explicitly
export { VOTE_HOST_DEV, PUBLIC_API_HOST_DEV, AUTOCOMPLETE_API_HOST_DEV, PUBLIC_DATA_BUCKET_URL_DEV };
export { VOTE_HOST_PROD, PUBLIC_API_HOST_PROD, AUTOCOMPLETE_API_HOST_PROD, PUBLIC_DATA_BUCKET_URL_PROD };
