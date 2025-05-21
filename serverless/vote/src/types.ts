// Vote storage format in S3
export interface VoteAuthor {
    title: string;
    name: string;
    actingCapacity: 'individual' | 'representingCityAdministration';
}

export interface VoteEntry {
    time?: number;
    vote: 'Yes' | 'No' | 'Sign';
    author: VoteAuthor;
    associatedCityId?: string; // wikidataId
    organisationNameFallback?: string;
    externalVerificationSource?: string; // URL
}

export interface PollData {
    organisedBy?: string;
    URL?: string;
    type: 'poll' | 'jointStatement';
    votes: VoteEntry[];
    createdAt?: number;
}

export type VoteData = Record<string, PollData>;


// City data format
export interface City {
    id: string;
    name: string;
    population: number;
    country: string;
    lat: number;
    lon: number;
    authenticationKeyDistributionChannels: {
        account: string;
        type: 'linkedin' | 'email';
        confidence: number;
    }[];
}

// API Request/Response types
export interface ValidateTokenRequest {
    action: 'validateToken';
    token: string;
}

export interface VoteRequest {
    action: 'vote';
    cityId?: string;
    token: string;
    pollId: string;
    option: string;
    title: string;
    name: string;
    actingCapacity: 'individual' | 'representingCityAdministration';
}

export interface GetVotesRequest {
    action: 'getVotes';
    cityId?: string;
    token: string;
}

export interface GetCitiesRequest {
    action: 'getCities';
    token: string;
}

export interface CreatePollRequest {
    action: 'createPoll';
    token: string;
    pollId: string;
    documentUrl?: string;
    organisedBy?: string;
}

export interface GetUploadUrlRequest {
    action: 'getUploadUrl';
    pollId: string;
    token: string;
    fileHash: string; // Hash of the file contents (required)
}

// Internal interfaces used by the backend
export interface ValidateTokenParams {
    resolvedCity: City;
    token: string;
}

export interface VoteParams {
    cityId?: string;
    resolvedCity: City;
    token: string;
    pollId: string;
    option: string;
    title: string;
    name: string;
    actingCapacity: 'individual' | 'representingCityAdministration';
    externalVerificationSource?: string; // Platform that verified this vote
}

export interface CreatePollParams {
    resolvedCity: City;
    token: string;
    pollId: string;
    documentUrl?: string;
    organisedBy?: string;
}

export interface GetUploadUrlParams {
    resolvedCity: City;
    token: string;
    pollId: string;
    fileHash: string; // Hash of the file contents (required)
}

// API Response types
export interface ValidateTokenResponse {
    city: City;
    cityId: string;
    message?: string;
    details?: string;
}

export interface UploadAttachmentResponse {
    message: string;
    uploadUrl?: string;
    getUrl?: string;
    pollId?: string;
    details?: string;
}

export interface VoteResponse {
    message: string;
}

export interface GetVotesResponse {
    votes: VoteData;
    message?: string;
}

export interface GetCitiesResponse {
    cities: Record<string, City>;
}

export interface CreatePollResponse {
    message: string;
}
