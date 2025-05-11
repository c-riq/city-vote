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

// Public API Request/Response types (no authentication required)
export interface GetPublicVotesRequest {
    action: 'getVotes';
    cityId?: string;
}

export interface GetPublicCitiesRequest {
    action: 'getCities';
}

// API Response types
export interface GetVotesResponse {
    votes: VoteData;
    message?: string;
}

export interface GetCitiesResponse {
    cities: Record<string, City>;
}
