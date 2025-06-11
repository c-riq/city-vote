import { useState, useEffect } from 'react';
import { City, VoteData } from '../backendTypes';
import { AUTOCOMPLETE_API_HOST } from '../constants';

// Global memory cache for city data to persist across component re-renders
const globalCityCache = new Map<string, City>();

/**
 * Custom hook to manage city data fetching and caching
 */
export const useCityData = (votesData: VoteData = {}) => {
  // Initialize cities state with cached data
  const [cities, setCities] = useState<Record<string, City>>(() => {
    const cached: Record<string, City> = {};
    globalCityCache.forEach((city, id) => {
      cached[id] = city;
    });
    return cached;
  });
  const [attemptedCityIds, setAttemptedCityIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch all cities data - now relies on the automatic fetching from votes data
  const fetchAllCities = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      // Since getCities is deprecated, we'll rely on the automatic city fetching
      // from vote data via the autocomplete API. This function now just triggers
      // a refresh of the existing city data.
      
      // Reset attempted city IDs to allow refetching
      setAttemptedCityIds(new Set());
      
      // The useEffect will automatically fetch missing cities
      return cities;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh cities data');
      return {};
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch missing cities using batch lookup
  useEffect(() => {
    const fetchMissingCities = async () => {
      // Collect all city IDs from all votes
      const allCityIds: string[] = [];
      
      Object.values(votesData).forEach(pollData => {
        pollData.votes.forEach(vote => {
          if (vote.associatedCityId) {
            allCityIds.push(vote.associatedCityId);
          }
        });
      });
      
      // Find missing city IDs (those that are in votes but not in cities object or global cache)
      // and that we haven't attempted to fetch before
      const uniqueCityIds = [...new Set(allCityIds)];
      const missingCityIds = uniqueCityIds.filter(id =>
        id && !cities[id] && !globalCityCache.has(id) && !attemptedCityIds.has(id)
      );
      
      // If there are no missing cities, return
      if (missingCityIds.length === 0) return;
      
      // Add these IDs to the attempted set to prevent refetching
      const newAttemptedIds = new Set(attemptedCityIds);
      missingCityIds.forEach(id => newAttemptedIds.add(id));
      setAttemptedCityIds(newAttemptedIds);
      
      // Process in batches of 50 to prevent too many requests
      const BATCH_SIZE = 50;
      
      // Process missing cities in batches
      for (let i = 0; i < missingCityIds.length; i += BATCH_SIZE) {
        const batchIds = missingCityIds.slice(i, i + BATCH_SIZE);
        
        try {
          // Use the batch lookup API to fetch missing cities
          const response = await fetch(AUTOCOMPLETE_API_HOST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'batchGetByQid',
              qids: batchIds
            })
          });
          
          if (!response.ok) {
            console.error('Failed to fetch missing cities');
            continue;
          }
          
          const data = await response.json();
          
          if (data.results && Array.isArray(data.results)) {
            // Convert the results to the City format and update both cache and state
            const batchCities: Record<string, City> = {};
            data.results.forEach((city: {
              wikidataId: string;
              name: string;
              countryName: string;
              population?: number;
              latitude?: number;
              longitude?: number;
            }) => {
              const cityData: City = {
                id: city.wikidataId,
                name: city.name,
                country: city.countryName,
                population: city.population || 0,
                lat: city.latitude || 0,
                lon: city.longitude || 0,
                authenticationKeyDistributionChannels: []
              };
              
              batchCities[city.wikidataId] = cityData;
              // Update global cache
              globalCityCache.set(city.wikidataId, cityData);
            });
            
            // Update cities state immediately with this batch
            setCities(prevCities => ({
              ...prevCities,
              ...batchCities
            }));
          }
        } catch (error) {
          console.error('Error fetching missing cities batch:', error);
        }
      }
    };
    
    fetchMissingCities();
  }, [votesData, cities, attemptedCityIds]);

  return {
    cities,
    setCities,
    fetchAllCities,
    isLoading,
    error
  };
};

export default useCityData;
