import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import VoteList from './VoteList';
import { VoteData, GetVotesResponse, City } from '../backendTypes';
import { PUBLIC_API_HOST } from '../constants';
import { getDisplayTitle, isJointStatement } from '../utils/pollFormat';
import useCityData from '../hooks/useCityData';

interface PollsProps {
  token?: string;
  cityInfo?: City;
  votesData?: VoteData;
  onRefresh?: () => void;
}

function Polls({ token, cityInfo, votesData: propVotesData, onRefresh }: PollsProps) {
  const [votesData, setVotesData] = useState<VoteData>(propVotesData || {});
  const [isRefreshingVotes, setIsRefreshingVotes] = useState(false);
  const [isAuthenticated] = useState(!!token && !!cityInfo);
  
  // Use the city data hook to manage cities
  const { 
    cities, 
    fetchAllCities, 
    isLoading: isCitiesLoading, 
    error: cityError 
  } = useCityData(votesData);
  
  const [isLoading, setIsLoading] = useState(!propVotesData);
  const [error, setError] = useState('');

  useEffect(() => {
    // Only fetch data if we don't have any votes data from props
    // and we're not already loading data
    if (!propVotesData && Object.keys(votesData).length === 0 && !isLoading) {
      fetchData();
    }
  }, [propVotesData, votesData, isLoading]);

  // Update state when props change
  useEffect(() => {
    if (propVotesData) {
      setVotesData(propVotesData);
    }
  }, [propVotesData]);

  // Update error state if city error occurs
  useEffect(() => {
    if (cityError) {
      setError(cityError);
    }
  }, [cityError]);

  const fetchData = async () => {
    setError('');
    setIsLoading(true);
    
    try {
      // Fetch cities data using the hook
      await fetchAllCities();

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

  if (isLoading || isCitiesLoading) {
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
              cityId: vote.associatedCityId || '',
              timestamp: vote.time || 0,
              option: vote.vote,
              voteInfo: vote.author,
              city: vote.organisationNameFallback
            };
          })
          .sort((a, b) => b.timestamp - a.timestamp);
          
          // Truncate votes to 10 for display
          const truncatedVotes = allVotes.slice(0, 10);
          const hasMoreVotes = allVotes.length > 10;
          
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
                votes={truncatedVotes} 
                cities={cities} 
                variant="cell" 
                isJointStatement={isJointStatement(pollId)}
              />
              {hasMoreVotes && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Link to={`/poll/${encodeURIComponent(pollId)}`} style={{ textDecoration: 'none' }}>
                    <Button 
                      variant="text" 
                      size="small" 
                      endIcon={<span className="material-icons">arrow_forward</span>}
                    >
                      View all {allVotes.length} votes
                    </Button>
                  </Link>
                </Box>
              )}
            </Box>
          );
        })
      )}
    </Box>
  );
}

export default Polls;
