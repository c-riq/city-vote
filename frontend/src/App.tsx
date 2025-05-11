import { Button, Container, Typography, TextField, Box, Dialog, 
  DialogTitle, DialogContent, DialogActions, createTheme, 
  ThemeProvider  } from '@mui/material';
import { useState } from 'react';
import { VOTE_HOST, PUBLIC_API_HOST } from './constants';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate, Link } from 'react-router-dom';
import Poll from './components/Poll';
import Polls from './components/Polls';
import Header from './components/Header';
// import CityMap from './components/CityMap';
import WorldMap from './components/WorldMap';
import CityInfoBox from './components/CityInfoBox';
import VoteList from './components/VoteList';
import CityRegistration from './components/CityRegistration';
import {
  City,
  ValidateTokenResponse,
  GetCitiesResponse,
  GetVotesResponse
} from './voteBackendTypes';

type Vote = [number, string, { title: string; name: string; actingCapacity: 'individual' | 'representingCityAdministration' }];
type CityVotes = Record<string, Vote[]>;  // cityId -> votes
type PollVotes = Record<string, CityVotes>;  // pollId -> city votes

function CityRoute({ cityInfo, cities, theme }: { 
  cityInfo: City | null,
  cities: Record<string, City>,
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
  const [cityInfo, setCityInfo] = useState<City | null>(null);
  const [cityId, setCityId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [votesData, setVotesData] = useState<PollVotes>({});
  const [cities, setCities] = useState<Record<string, City>>({});
  const [polls, _] = useState<Record<string, any>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRefreshingVotes, setIsRefreshingVotes] = useState(false);

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

      // First set the city info
      setCityInfo(data.city);
      setCityId(data.cityId);
      
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
      setCityId(null);
      setVotesData({});
      setCities({});
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVotesOnly = async () => {
    setIsRefreshingVotes(true);
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

      setVotesData(votesData?.votes || {});
    } catch (err) {
      console.error('Failed to fetch votes:', err);
    } finally {
      setIsRefreshingVotes(false);
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
    const [isCreatingPoll, setIsCreatingPoll] = useState(false);

    const handleCreatePoll = async () => {
        if (!question.trim()) return;
        
        setIsCreatingPoll(true);
        try {
            const response = await fetch(VOTE_HOST, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'createPoll',
                    token,
                    pollId: question.trim()
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to create poll');
            }

            setIsModalOpen(false);
            const encodedQuestion = encodeURIComponent(question.trim());
            navigate(`/poll/${encodedQuestion}`);
            setQuestion('');
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to create poll');
        } finally {
            setIsCreatingPoll(false);
        }
    };

    const handleCancel = () => {
        setQuestion('');
        setIsModalOpen(false);
    };

    return (
        <Box component="div">
            <Dialog 
                open={isModalOpen} 
                onClose={handleCancel}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle component="div" sx={{ pb: 2, pt: 3, px: 3 }}>
                    New Poll Question
                </DialogTitle>
                <DialogContent sx={{ px: 3, pb: 3 }}>
                    <TextField
                        fullWidth
                        label="Question"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Button 
                        onClick={handleCreatePoll}
                        disabled={!question.trim() || isCreatingPoll}
                    >
                        {isCreatingPoll ? 'Creating...' : 'Create Poll'}
                    </Button>
                </DialogActions>
            </Dialog>
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
            <Route path="/register" element={<CityRegistration />} />
            <Route path="/polls" element={<Polls theme={theme} />} />
            <Route path="/poll/:pollId" element={
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
                <Poll />
              )
            } />
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
                      Please enter your city access token
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
                        autoComplete="off"
                        inputProps={{
                          autoComplete: 'off',
                          'data-form-type': 'other',
                        }}
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
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    gap: 2,
                    mt: 4,
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
                  {Object.entries(votesData).map(([pollId, citiesVotes]) => {
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
                  })}
                </Box>
              )
            } />
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

function PollWrapper({ 
  token, 
  cityInfo, 
  polls, 
  onVoteComplete, 
  votesData, 
  cities 
}: {
  token: string;
  cityInfo: City;
  polls: Record<string, any>;
  onVoteComplete: () => void;
  votesData: PollVotes;
  cities: Record<string, City>;
}) {
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
