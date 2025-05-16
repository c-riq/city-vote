// City data format for autocomplete
export interface CityAutocompleteData {
    header: string[];
    cities: string[][];
}

// API Request/Response types
export interface AutocompleteRequest {
    action: 'autocomplete';
    query: string;
    limit?: number;
}

export interface AutocompleteResponse {
    results: {
        wikidataId: string;
        name: string;
        countryWikidataId: string;
        countryName: string;
        countryCode: string;
        population?: number;
        coordinates?: {
            latitude: number;
            longitude: number;
        };
        officialWebsite?: string;
    }[];
    message?: string;
}
