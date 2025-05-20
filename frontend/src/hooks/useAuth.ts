import { useState, useEffect } from 'react';
import { VOTE_HOST, PUBLIC_API_HOST } from '../constants';
import { City, ValidateTokenResponse, GetCitiesResponse, GetVotesResponse, VoteData } from '../backendTypes';

interface UseAuthReturn {
  token: string;
  setToken: (token: string) => void;
  cityInfo: City | null;
  error: string;
  isLoading: boolean;
  votesData: VoteData;
  cities: Record<string, City>;
  fetchData: () => Promise<void>;
  fetchVotesOnly: () => Promise<void>;
  handleLogout: () => void;
}

export function useAuth(): UseAuthReturn {
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem('token');
    return saved ? saved : '';
  });
  
  const [cityInfo, setCityInfo] = useState<City | null>(() => {
    const saved = localStorage.getItem('cityInfo');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [votesData, setVotesData] = useState<VoteData>({});
  const [cities, setCities] = useState<Record<string, City>>({});

  // Auto-fetch data if token exists in localStorage
  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      const response = await fetch(VOTE_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'validateToken',
          token
        })
      });

      const data: ValidateTokenResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.details || 'Authentication failed');
      }

      // First set the city info and persist to localStorage
      setCityInfo(data.city);
      localStorage.setItem('token', token);
      localStorage.setItem('cityInfo', JSON.stringify(data.city));
      
      // Then fetch cities data
      const citiesResponse = await fetch(`${PUBLIC_API_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getCities' })
      });

      const citiesData: GetCitiesResponse = await citiesResponse.json();

      if (!citiesResponse.ok) {
        throw new Error('Failed to fetch cities');
      }

      // Update cities data
      setCities(citiesData.cities);

      // Finally fetch votes data
      const votesResponse = await fetch(`${PUBLIC_API_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getVotes' })
      });

      const votesData: GetVotesResponse = await votesResponse.json();

      if (!votesResponse.ok) {
        console.error(votesData.message || 'Failed to fetch votes');
      }

      setVotesData(votesData?.votes || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate');
      setCityInfo(null);
      setVotesData({});
      setCities({});
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVotesOnly = async () => {
    try {
      const votesResponse = await fetch(`${PUBLIC_API_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getVotes' })
      });

      const votesData: GetVotesResponse = await votesResponse.json();

      if (!votesResponse.ok) {
        console.error(votesData.message || 'Failed to fetch votes');
        return;
      }

      // Set the votes data directly
      setVotesData(votesData?.votes || {});
    } catch (err) {
      console.error('Failed to fetch votes:', err);
    }
  };

  const handleLogout = () => {
    setCityInfo(null);
    setToken('');
    setVotesData({});
    setCities({});
    
    // Clear localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('cityInfo');
  };

  return {
    token,
    setToken,
    cityInfo,
    error,
    isLoading,
    votesData,
    cities,
    fetchData,
    fetchVotesOnly,
    handleLogout
  };
}
