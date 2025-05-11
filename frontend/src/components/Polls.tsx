import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import VoteList from './VoteList';
import { VoteData, GetVotesResponse, City } from '../voteBackendTypes';
import { PUBLIC_API_HOST } from '../constants';

interface PollsProps {
  theme?: any;
  token?: string;
  cityInfo?: City;
  votesData?: VoteData;
  cities?: Record<string, City>;
  onRefresh?: () => void;
}

function Polls({ token, cityInfo, votesData: propVotesData, cities: propCities, onRefresh }: PollsProps) {
  const [votesData, setVotesData] = useState<VoteData>(propVotesData || {});
  const [cities, setCities] = useState<Record<string, any>>(propCities || {});
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
        Object.entries(votesData).map(([pollId, citiesVotes]) => {
          const allVotes = Object.entries(citiesVotes)
            .flatMap(([cityId, votes]) => 
              votes.map(([timestamp, option, voteInfo]) => ({
                cityId,
                timestamp,
                option,
                voteInfo
              }))
            )
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
                <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 500, mb: 2 }}>
                  {pollId}
                </Typography>
              </Link>
              <VoteList 
                votes={allVotes} 
                cities={cities} 
                variant="cell" 
              />
            </Box>
          );
        })
      )}
    </Box>
  );
}

export default Polls;
