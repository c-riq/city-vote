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

export interface GetVotesResponse {
    // added here for allowing the backend types to be copied to the frontend VoteData is defined in votes/types.ts
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    votes: VoteData;
    message?: string;
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
