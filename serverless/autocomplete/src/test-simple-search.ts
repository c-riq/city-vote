import { searchCities, CityData } from './autocomplete';

// Simple test for a single search query
async function testSimpleSearch() {
  const query = 'izmir';
  console.log(`Searching for: "${query}"`);
  
  try {
    // Call the search function directly
    const results = await searchCities(query, 50);
    
    console.log(`Found ${results.length} results:`);
    
    // Display the results in a clean format
    results.forEach((city: CityData, index: number) => {
      console.log(`${index + 1}. ${city.name}, ${city.countryName} (${city.wikidataId})`);
    });
  } catch (error) {
    console.error('Search failed:', error);
  }
}

// Run the test
testSimpleSearch();
