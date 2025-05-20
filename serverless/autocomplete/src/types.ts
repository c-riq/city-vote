// City data format for autocomplete
export interface CityAutocompleteData {
    header: string[];
    cities: string[][];
}

// City result type
export interface CityResult {
    wikidataId: string;
    name: string;
    countryWikidataId: string;
    countryName: string;
    countryCode: string;
    population?: number;
    populationDate?: string;
    latitude?: number;
    longitude?: number;
    officialWebsite?: string;
    socialMedia?: {
        twitter?: string;
        facebook?: string;
        instagram?: string;
        youtube?: string;
        linkedin?: string;
    };
    supersedes_duplicates?: string[];
    superseded_by?: string;
}

// Base request with common properties
interface BaseRequest {
    limit?: number;
}

// Specific request types for each action
export interface AutocompleteActionRequest extends BaseRequest {
    action: 'autocomplete';
    query: string;
}

export interface GetByQidActionRequest extends BaseRequest {
    action: 'getByQid';
    qid: string;
}

export interface BatchGetByQidActionRequest extends BaseRequest {
    action: 'batchGetByQid';
    qids: string[];
}

export interface BatchAutocompleteActionRequest extends BaseRequest {
    action: 'batchAutocomplete';
    queries: string[];
}

// Union type for all possible request types
export type AutocompleteRequest = 
    | AutocompleteActionRequest 
    | GetByQidActionRequest 
    | BatchGetByQidActionRequest 
    | BatchAutocompleteActionRequest;

// Response types
export interface AutocompleteResponse {
    results: CityResult[];
    message?: string;
}

export interface BatchAutocompleteResponse {
    results: Record<string, CityResult[]>;
    message?: string;
}

export interface BatchGetByQidResponse {
    results: CityResult[];
    notFound?: string[];
    message?: string;
}
