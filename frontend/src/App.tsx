import { Button, Container, Typography, TextField, Box, Dialog, DialogTitle, DialogContent, DialogActions, createTheme, ThemeProvider } from '@mui/material';
import { useState } from 'react';
import { VOTE_HOST } from './constants';
import { BrowserRouter, Routes, Route, Navigate, useParams, Link, useNavigate } from 'react-router-dom';
import Poll from './components/Poll';
import Header from './components/Header';
import CityMap from './components/CityMap';
import WorldMap from './components/WorldMap';

interface CityInfo {
  id: string;
  name: string;
  population: number;
  country: string;
  lat: number;
  lon: number;
}

interface TokenResponse {
  city: CityInfo;
  cityId: string;
  message?: string;
  details?: string;
}

interface CitiesResponse {
  cities: Record<string, CityInfo>;
}

type Vote = [number, string];  // [timestamp, option]
type CityVotes = Record<string, Vote[]>;  // cityId -> votes
type PollVotes = Record<string, CityVotes>;  // pollId -> city votes

interface VotesResponse {
  votes: PollVotes;
  message?: string;
}

function App() {
  const theme = createTheme({
    palette: {
      primary: {
        main: '#757575',
        dark: '#424242',
        light: '#9e9e9e',
        contrastText: '#ffffff',
      },
    },
  });

  const [token, setToken] = useState('');
  const [cityInfo, setCityInfo] = useState<CityInfo | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [votesData, setVotesData] = useState<PollVotes>({});
  const [cities, setCities] = useState<Record<string, CityInfo>>({});
  const [polls, _] = useState<Record<string, any>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);

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

      const data: TokenResponse = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.details || 'Authentication failed');
      }

      // First set the city info
      setCityInfo(data.city);
      setCityId(data.cityId);
      
      // Then fetch cities data
      const citiesResponse = await fetch(`${VOTE_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getCities', token })
      });

      const citiesData: CitiesResponse = await citiesResponse.json();

      if (!citiesResponse.ok) {
        throw new Error('Failed to fetch cities');
      }

      // Update cities data
      setCities(citiesData.cities);

      // Finally fetch votes data
      const votesResponse = await fetch(`${VOTE_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getVotes', token })
      });

      const votesData: VotesResponse = await votesResponse.json();

      if (!votesResponse.ok) {
        throw new Error(votesData.message || 'Failed to fetch votes');
      }

      setVotesData(votesData.votes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate');
      setCityInfo(null);
      setCityId(null);
      setVotesData({});
      setCities({});
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    fetchData();
  };

  const handleLogout = () => {
    setCityInfo(null);
    setCityId(null);
    setToken('');
    setVotesData({});
    setCities({});
  };

  function AuthenticatedContent() {
    const navigate = useNavigate();
    const [question, setQuestion] = useState('');

    const handleCreatePoll = () => {
      if (question.trim()) {
        setIsModalOpen(false);
        navigate(`/poll/${encodeURIComponent(question)}`);
        setQuestion('');
      }
    };

    const handleCancel = () => {
      setQuestion('');
      setIsModalOpen(false);
    };

    return (
      <>
        <Dialog open={isModalOpen} onClose={handleCancel}>
          <DialogTitle component="div">New Poll Question</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              margin="normal"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancel}>Cancel</Button>
            <Button 
              onClick={handleCreatePoll}
              disabled={!question.trim()}
            >
              Create Poll
            </Button>
          </DialogActions>
        </Dialog>

        {cityInfo && (
          <Box sx={{ position: 'fixed', top: 16, right: 16, zIndex: 1000 }}>
            <Button 
              onClick={() => setIsModalOpen(true)} 
              variant="contained" 
              color="primary"
            >
              Create New Poll
            </Button>
          </Box>
        )}
      </>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Header
          cityInfo={cityInfo}
          onLogout={handleLogout}
          onCreatePoll={() => setIsModalOpen(true)}
        />
        <Container sx={{ pt: '80px' }}>
          <AuthenticatedContent />
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
                  <WorldMap />
                  <Typography variant="h5">Please enter your access token</Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    maxWidth: 400, 
                    width: '100%' 
                  }}>
                    <TextField
                      label="Access Token"
                      variant="outlined"
                      fullWidth
                      sx={{ 
                        '& input': { fontSize: '0.9rem' },
                        '& .MuiOutlinedInput-root': {
                          borderTopRightRadius: 0,
                          borderBottomRightRadius: 0,
                        }
                      }}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      error={!!error}
                    />
                    <Button 
                      variant="contained" 
                      onClick={handleSubmit}
                      disabled={isLoading}
                      sx={{ 
                        height: '56px', 
                        minWidth: '120px',
                        px: 6,
                        backgroundColor: 'primary.dark',
                        '&:hover': {
                          backgroundColor: 'primary.main',
                        },
                        textTransform: 'none',
                        boxShadow: 2,
                        borderTopLeftRadius: 0,
                        borderBottomLeftRadius: 0,
                      }}
                      startIcon={<span className="material-icons">key</span>}
                    >
                      {isLoading ? 'Validating...' : 'Authenticate'}
                    </Button>
                  </Box>
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
                  <Box sx={{ 
                    width: '100%', 
                    textAlign: 'center',
                    mb: 4,
                    p: 2,
                    bgcolor: 'background.paper',
                    borderRadius: 1,
                    boxShadow: 1
                  }}>
                    <Typography variant="h4">{cityInfo?.name}</Typography>
                    <Typography variant="body2">
                      ID: <Link 
                        to={`https://www.wikidata.org/wiki/${cityId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {cityId}
                      </Link>
                    </Typography>
                  </Box>
                  
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
                          <Typography variant="h6">{pollId}</Typography>
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
                      setCityId(null);
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
                    onVoteComplete={fetchData}
                    votesData={votesData}
                    cities={cities}
                  />
                ) : (
                  <Navigate to="/" replace />
                )
              } 
            />
          </Routes>
          {cityInfo && (
            <Box sx={{ mb: 4 }}>
              <CityMap cities={cities} currentCity={cityInfo} />
            </Box>
          )}
        </Container>
      </BrowserRouter>
    </ThemeProvider>
  );
}

function PollWrapper({ token, cityInfo, polls, onVoteComplete, votesData, cities }: any) {
  const { pollId } = useParams();
  
  if (pollId && polls[pollId]) {
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

  // If it's a new poll (pollId contains the question)
  return (
    <Poll 
      token={token} 
      cityInfo={cityInfo} 
      pollData={null}
      onVoteComplete={onVoteComplete}
      votesData={votesData}
      cities={cities}
    />
  );
}

export default App;