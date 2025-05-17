// Vote storage format in S3 (underscore added to prevent name collision in synced file)
export type VoteData_ = Record<string, Record<string, [number, string, {
    title: string;
    name: string;
    actingCapacity: 'individual' | 'representingCityAdministration';
}][]>>;

// City data format
export interface City {
    id: string;
    name: string;
    authenticationKeyDistributionChannels: {
        account: string;
        type: 'linkedin' | 'email';
        confidence: number;
    }[];
}

export interface GetPublicVotesRequest {
    action: 'getVotes';
    cityId?: string;
}

export interface GetPublicCitiesRequest {
    action: 'getCities';
}

export interface GetVotesResponse {
    votes: VoteData_;
    message?: string;
}

export interface GetCitiesResponse {
    cities: Record<string, City>;
}

// Registration API Request/Response types
export interface RegisterRequest {
    action: 'register';
    cityData: City;
}

export interface RegisterResponse {
    message: string;
    city?: City;
    error?: string;
}
