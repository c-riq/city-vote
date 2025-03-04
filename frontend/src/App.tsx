import { Button, Container, Typography, TextField, Box } from '@mui/material';
import { useState } from 'react';
import { VOTE_HOST } from './constants';
import { BrowserRouter, Routes, Route, Link, Navigate, useParams } from 'react-router-dom';
import Poll from './components/Poll';

function App() {
  const [token, setToken] = useState('');
  const [cityInfo, setCityInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [votesData, setVotesData] = useState<Record<string, Record<string, [number, number][]>>>({});
  const [cities, setCities] = useState<Record<string, any>>({});
  const [polls, setPolls] = useState<Record<string, any>>({});

  const fetchVotes = async () => {
    try {
      const response = await fetch(VOTE_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getVotes',
          token
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch votes');
      }

      setVotesData(data.votes);
      // Extract unique poll IDs from the votes data
      const pollIds = Object.keys(data.votes);
      // Create a simple polls object with IDs
      const pollsData = pollIds.reduce((acc, id) => ({
        ...acc,
        [id]: {
          id,
          title: `Poll ${id}`,
          description: "Vote on this poll",
          options: ["Yes", "No"]  // Default options
        }
      }), {});
      setPolls(pollsData);
      console.log('Created polls from votes:', pollsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch votes');
    }
  };

  const fetchCities = async () => {
    try {
      const response = await fetch(VOTE_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getCities',
          token
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch cities');
      }

      setCities(data.cities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cities');
    }
  };

  const handleSubmit = async () => {
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

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.details || 'Authentication failed');
      }

      setCityInfo(data.city);
      await Promise.all([fetchVotes(), fetchCities()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate');
      setCityInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BrowserRouter>
      <Container>
        <Routes>
          <Route path="/" element={
            !cityInfo ? (
              <Box
                sx={{
                  height: '100vh',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2
                }}
              >
                <Typography variant="h4">Please enter your access token</Typography>
                <TextField
                  label="Access Token"
                  variant="outlined"
                  fullWidth
                  sx={{ maxWidth: 400 }}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  error={!!error}
                />
                {error && (
                  <Typography 
                    color="error" 
                    sx={{ 
                      maxWidth: 400, 
                      textAlign: 'center',
                      backgroundColor: 'error.light',
                      color: 'error.contrastText',
                      padding: 1,
                      borderRadius: 1,
                      width: '100%'
                    }}
                  >
                    {error}
                  </Typography>
                )}
                <Button 
                  variant="contained" 
                  onClick={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? 'Validating...' : 'Submit'}
                </Button>
              </Box>
            ) : (
              <Box
                sx={{
                  padding: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                <Typography variant="h4">Welcome, {cityInfo.name}!</Typography>
                <Typography>Population: {cityInfo.population}</Typography>
                
                {/* Votes Display */}
                <Typography variant="h5" sx={{ mt: 4 }}>Voting History</Typography>
                {Object.keys(votesData).length > 0 ? (
                  Object.entries(votesData).map(([pollId, citiesVotes]) => (
                    <Box 
                      key={pollId} 
                      sx={{ 
                        width: '100%',
                        maxWidth: 600,
                        bgcolor: 'background.paper',
                        p: 2,
                        borderRadius: 1,
                        boxShadow: 1,
                        mb: 2
                      }}
                    >
                      <Link to={`/poll/${pollId}`} style={{ textDecoration: 'none' }}>
                        <Typography variant="h6">Poll ID: {pollId}</Typography>
                      </Link>
                      {Object.entries(citiesVotes).map(([cityId, votes]) => (
                        <Box key={cityId} sx={{ mt: 2 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            City: {cities[cityId]?.name || cityId}
                          </Typography>
                          {votes.map(([timestamp, option], index) => (
                            <Typography key={index} sx={{ ml: 2 }}>
                              {new Date(timestamp).toLocaleString()}: Voted {option}
                            </Typography>
                          ))}
                        </Box>
                      ))}
                    </Box>
                  ))
                ) : (
                  <Typography color="text.secondary">No voting history available</Typography>
                )}

                <Button 
                  variant="outlined" 
                  onClick={() => {
                    setCityInfo(null);
                    setToken('');
                    setVotesData({});
                    setCities({});
                  }}
                  sx={{ mt: 2 }}
                >
                  Logout
                </Button>
              </Box>
            )
          } />
          <Route 
            path="/poll/:pollId" 
            element={
              cityInfo ? (
                <PollWrapper 
                  token={token} 
                  cityInfo={cityInfo} 
                  polls={polls}
                  onVoteComplete={fetchVotes}
                  votesData={votesData}
                  cities={cities}
                />
              ) : (
                <Navigate to="/" replace />
              )
            } 
          />
        </Routes>
      </Container>
    </BrowserRouter>
  );
}

function PollWrapper({ token, cityInfo, polls, onVoteComplete, votesData, cities }: any) {
  const { pollId } = useParams();
  if (!polls || !polls[pollId]) {
    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography>Loading poll data...</Typography>
      </Box>
    );
  }
  return (
    <Poll 
      token={token} 
      cityInfo={cityInfo} 
      pollData={polls[pollId]}
      onVoteComplete={onVoteComplete}
      votesData={votesData}
      cities={cities}
    />
  );
}

export default App;