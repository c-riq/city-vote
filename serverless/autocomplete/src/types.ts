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
        populationDate?: string;
        coordinates?: {
            latitude: number;
            longitude: number;
        };
        officialWebsite?: string;
        socialMedia?: {
            twitter?: string;
            facebook?: string;
            instagram?: string;
            youtube?: string;
            linkedin?: string;
        };
    }[];
    message?: string;
}
