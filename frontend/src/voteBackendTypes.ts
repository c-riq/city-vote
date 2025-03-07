// Vote storage format in S3
export type VoteData = Record<string, Record<string, [number, string, {
    title: string;
    name: string;
    actingCapacity: 'individual' | 'representingCityAdministration';
}][]>>;

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
}

// API Response types
export interface ValidateTokenResponse {
    city: City;
    cityId: string;
    message?: string;
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