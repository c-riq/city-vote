import { Button, Container, Typography, TextField, Box, Dialog, 
  DialogTitle, DialogContent, DialogActions, createTheme, 
  ThemeProvider  } from '@mui/material';
import { useState } from 'react';
import { VOTE_HOST } from './constants';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, Link } from 'react-router-dom';
import Poll from './components/Poll';
import Header from './components/Header';
// import CityMap from './components/CityMap';
import WorldMap from './components/WorldMap';
import CityInfoBox from './components/CityInfoBox';

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

function CityRoute({ cityInfo, cities, theme }: { 
  cityInfo: CityInfo | null,
  cities: Record<string, CityInfo>,
  theme: any
}) {
  const { cityId } = useParams();
  
  if (!cityInfo) {
    return <Navigate to="/" replace />;
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
      <CityInfoBox 
        cityId={cityId || null} 
        cityInfo={cityInfo} 
        cities={cities} 
        theme={theme} 
      />
    </Box>
  );
}

function App() {
  const theme = createTheme({
    palette: {
      primary: {
        main: '#1a237e',
        dark: '#000051',
        light: '#534bae',
        contrastText: '#ffffff',
      },
      background: {
        default: '#f5f5f7',
        paper: '#ffffff',
      },
    },
    typography: {
      h4: {
        fontWeight: 600,
        letterSpacing: '0.02em',
      },
      h5: {
        fontWeight: 500,
        letterSpacing: '0.01em',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            fontWeight: 500,
            boxShadow: 'none',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
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
        const encodedQuestion = encodeURIComponent(question.trim());
        navigate(`/poll/${encodedQuestion}`);
        setQuestion('');
      }
    };

    const handleCancel = () => {
      setQuestion('');
      setIsModalOpen(false);
    };

    return (
      <Box component="div">
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
      </Box>
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
                    height: 'calc(100vh - 80px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 3,
                    overflow: 'hidden',
                    pt: { xs: 4, sm: 6 },
                    backgroundColor: 'background.default',
                  }}
                >
                  <Box sx={{ 
                    width: '100%',
                    maxWidth: '1000px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: { xs: 2, sm: 3 }
                  }}>
                    <Box sx={{ 
                      width: '100%', 
                      height: { xs: '250px', sm: '450px' },
                      borderRadius: 4,
                      overflow: 'hidden',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <WorldMap />
                    </Box>
                    <Typography 
                      variant="body1" 
                      sx={{ 
                        mb: 2,
                        color: 'text.secondary',
                        textAlign: 'center',
                        maxWidth: 600,
                        px: 2,
                      }}
                    >
                      Please enter your access token
                    </Typography>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      maxWidth: 400, 
                      width: '100%',
                      px: { xs: 2, sm: 0 }
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isLoading) {
                            handleSubmit();
                          }
                        }}
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
                          width: '100%',
                          mx: { xs: 2, sm: 0 }
                        }}
                      >
                        {error}
                      </Typography>
                    )}
                  </Box>
                  
                  <Box sx={{ 
                    position: 'fixed',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center',
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    opacity: 0.7
                  }}>
                    <Typography variant="caption" component="span">
                      Rix Data NL B.V. · Herengracht 551, 1017 BW Amsterdam · KVK 88818306 · 
                    </Typography>
                    <a
                      href="https://github.com/c-riq/city-vote"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ 
                        color: 'inherit',
                        textDecoration: 'none'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                    >
                      <Typography variant="caption" component="span">
                        Source code
                      </Typography>
                    </a>
                  </Box>
                </Box>
              ) : (
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
                  <CityInfoBox cityId={cityId} cityInfo={cityInfo} cities={cities} theme={theme} token={token} />
                  
                  {/* Votes Display */}
                  <Typography variant="h5" sx={{ mt: 4 }}>All votes</Typography>
                  {Object.keys(votesData).length > 0 ? (
                    Object.entries(votesData).map(([pollId, citiesVotes]) => (
                      <Box 
                        key={pollId} 
                        sx={{ 
                          width: '100%',
                          maxWidth: 800,
                          bgcolor: 'background.paper',
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
                          <Typography variant="h6">{pollId}</Typography>
                        </Link>
                        {Object.entries(citiesVotes).map(([cityId, votes]) => (
                          <Box key={cityId} sx={{ mt: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                              City: {
                                <Link 
                                  to={`/city/${cityId}`}
                                  style={{ 
                                    color: theme.palette.primary.main,
                                    textDecoration: 'none'
                                  }}
                                >
                                  {cities[cityId]?.name || cityId}
                                </Link>
                              }
                            </Typography>
                            {votes.map(([timestamp, option], index) => (
                              <Box key={index} sx={{ mt: 1 }}>
                                <Typography>
                                  {option} - {new Date(timestamp).toLocaleDateString()}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        ))}
                      </Box>
                    ))
                  ) : (
                    <Typography color="text.secondary">No voting history available</Typography>
                  )}
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
            <Route 
              path="/city/:cityId" 
              element={
                <CityRoute 
                  cityInfo={cityInfo} 
                  cities={cities} 
                  theme={theme} 
                />
              }
            />
          </Routes>
          {/* {cityInfo && (
            <Box sx={{ mb: 4 }}>
              <CityMap cities={cities} currentCity={cityInfo} />
            </Box>
          )} */}
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