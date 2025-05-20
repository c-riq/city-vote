import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import VoteList from './VoteList';
import { VoteData, GetVotesResponse, City } from '../backendTypes';
import { PUBLIC_API_HOST, AUTOCOMPLETE_API_HOST } from '../constants';
import { getDisplayTitle, isJointStatement } from '../utils/pollFormat';

interface PollsProps {
  token?: string;
  cityInfo?: City;
  votesData?: VoteData;
  cities?: Record<string, City>;
  onRefresh?: () => void;
}

function Polls({ token, cityInfo, votesData: propVotesData, cities: propCities, onRefresh }: PollsProps) {
  const [votesData, setVotesData] = useState<VoteData>(propVotesData || {});
  const [cities, setCities] = useState<Record<string, City>>(propCities || {});
  const [isLoading, setIsLoading] = useState(!propVotesData);
  const [error, setError] = useState('');
  const [isRefreshingVotes, setIsRefreshingVotes] = useState(false);
  const [isAuthenticated] = useState(!!token && !!cityInfo);

  useEffect(() => {
    if (!isAuthenticated && !propVotesData) {
      fetchData();
    }
  }, [isAuthenticated, propVotesData]);

  // Update state when props change
  useEffect(() => {
    if (propVotesData) {
      setVotesData(propVotesData);
    }
    if (propCities) {
      setCities(propCities);
    }
  }, [propVotesData, propCities]);

  // Keep track of city IDs we've already attempted to fetch
  const [attemptedCityIds, setAttemptedCityIds] = useState<Set<string>>(new Set());
  
  // Fetch missing cities using batch lookup
  useEffect(() => {
    const fetchMissingCities = async () => {
      // Collect all city IDs from all votes
      const allCityIds: string[] = [];
      
      Object.values(votesData).forEach(pollData => {
        pollData.votes.forEach(vote => {
          if (vote.associatedCity) {
            allCityIds.push(vote.associatedCity);
          }
        });
      });
      
      // Find missing city IDs (those that are in votes but not in cities object)
      // and that we haven't attempted to fetch before
      const uniqueCityIds = [...new Set(allCityIds)];
      const missingCityIds = uniqueCityIds.filter(id => 
        id && !cities[id] && !attemptedCityIds.has(id)
      );
      
      // If there are no missing cities, return
      if (missingCityIds.length === 0) return;
      
      // Add these IDs to the attempted set to prevent refetching
      const newAttemptedIds = new Set(attemptedCityIds);
      missingCityIds.forEach(id => newAttemptedIds.add(id));
      setAttemptedCityIds(newAttemptedIds);
      
      // Process in batches of 50 to prevent too many requests
      const BATCH_SIZE = 50;
      const newCities: Record<string, City> = { ...cities };
      
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
            // Convert the results to the City format and update the cities state
            data.results.forEach((city: { 
              wikidataId: string;
              name: string;
              countryName: string;
              population?: number;
              latitude?: number;
              longitude?: number;
            }) => {
              newCities[city.wikidataId] = {
                id: city.wikidataId,
                name: city.name,
                country: city.countryName,
                population: city.population || 0,
                lat: city.latitude || 0,
                lon: city.longitude || 0,
                authenticationKeyDistributionChannels: []
              };
            });
          }
        } catch (error) {
          console.error('Error fetching missing cities batch:', error);
        }
      }
      
      // Update cities state with all fetched data
      setCities(newCities);
    };
    
    fetchMissingCities();
  }, [votesData, attemptedCityIds]);

  const fetchData = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      // Fetch cities data
      const citiesResponse = await fetch(`${PUBLIC_API_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getCities' })
      });

      if (!citiesResponse.ok) {
        throw new Error('Failed to fetch cities');
      }

      const citiesData = await citiesResponse.json();
      setCities(citiesData.cities);

      // Fetch votes data
      const votesResponse = await fetch(`${PUBLIC_API_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getVotes' })
      });

      if (!votesResponse.ok) {
        throw new Error('Failed to fetch votes');
      }

      const votesData: GetVotesResponse = await votesResponse.json();
      
      // Set the votes data directly
      setVotesData(votesData?.votes || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setVotesData({});
      setCities({});
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVotesOnly = async () => {
    setIsRefreshingVotes(true);
    
    if (isAuthenticated && onRefresh) {
      // Use the parent's refresh function if authenticated
      onRefresh();
      setIsRefreshingVotes(false);
      return;
    }
    
    try {
      const votesResponse = await fetch(`${PUBLIC_API_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getVotes' })
      });

      if (!votesResponse.ok) {
        throw new Error('Failed to fetch votes');
      }

      const votesData: GetVotesResponse = await votesResponse.json();
      
      // Set the votes data directly
      setVotesData(votesData?.votes || {});
    } catch (err) {
      console.error('Failed to fetch votes:', err);
    } finally {
      setIsRefreshingVotes(false);
    }
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 'calc(100vh - 80px)',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          padding: { xs: 2, sm: 4 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          backgroundColor: 'background.default',
        }}
      >
        <Typography
          color="error"
          sx={{
            maxWidth: 600,
            textAlign: 'center',
            backgroundColor: 'error.light',
            color: 'error.contrastText',
            padding: 2,
            borderRadius: 2,
            width: '100%',
          }}
        >
          {error}
        </Typography>
        <Button
          variant="contained"
          onClick={fetchData}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        padding: { xs: 2, sm: 4 },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'background.default',
      }}
    >
   
      {/* Votes Display */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        gap: 2,
        mt: 2,
        width: '100%',
        maxWidth: 800
      }}>
        <Typography variant="h5">All Polls</Typography>
        <Button
          onClick={fetchVotesOnly}
          startIcon={
            isRefreshingVotes ? (
              <span className="material-icons" style={{ animation: 'spin 1s linear infinite' }}>sync</span>
            ) : (
              <span className="material-icons">refresh</span>
            )
          }
          disabled={isRefreshingVotes}
          size="small"
          sx={{ 
            minWidth: 'auto',
            '@keyframes spin': {
              '0%': {
                transform: 'rotate(0deg)',
              },
              '100%': {
                transform: 'rotate(360deg)',
              },
            },
          }}
        >
          {isRefreshingVotes ? 'Refreshing...' : 'Refresh'}
        </Button>
      </Box>
      
      {Object.entries(votesData).length === 0 ? (
        <Typography
          variant="body1"
          sx={{
            mt: 4,
            color: 'text.secondary',
            textAlign: 'center',
          }}
        >
          No polls found.
        </Typography>
      ) : (
        Object.entries(votesData).map(([pollId, pollData]) => {
          // Convert the new vote structure to the format expected by VoteList
          const allVotes = pollData.votes.map((vote) => {
            return {
              cityId: vote.associatedCity || '',
              timestamp: vote.time || 0,
              option: vote.vote,
              voteInfo: vote.author,
              city: vote.city
            };
          })
          .sort((a, b) => b.timestamp - a.timestamp);
          return (
            <Box 
              key={pollId} 
              sx={{ 
                width: '100%',
                maxWidth: 800,
                backgroundColor: 'background.paper',
                p: 3,
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                mb: 3,
                transition: 'transform 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-2px)',
                }
              }}
            >
              <Link to={`/poll/${encodeURIComponent(pollId)}`} style={{ textDecoration: 'none' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 500, mb: 2 }}>
                    {getDisplayTitle(pollId)}
                  </Typography>
                  {pollId.includes('_attachment_') && (
                    <span 
                      className="material-icons" 
                      style={{ 
                        fontSize: '1.2rem', 
                        color: '#1a237e',
                        opacity: 0.7,
                        marginBottom: '16px' // Match the mb: 2 (16px) from Typography
                      }}
                      title="Has attachment"
                    >
                      attach_file
                    </span>
                  )}
                </Box>
              </Link>
              <VoteList 
                votes={allVotes} 
                cities={cities} 
                variant="cell" 
                isJointStatement={isJointStatement(pollId)}
              />
            </Box>
          );
        })
      )}
    </Box>
  );
}

export default Polls;
