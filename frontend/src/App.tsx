import { Button, Container, Typography, TextField, Box, Dialog, 
  DialogTitle, DialogContent, DialogActions, createTheme, 
  ThemeProvider  } from '@mui/material';
import { useState, useEffect } from 'react';
import { VOTE_HOST, PUBLIC_API_HOST } from './constants';
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom';
import Poll from './components/Poll';
import Polls from './components/Polls';
import Header from './components/Header';
import WorldMap from './components/WorldMap';
import CityInfoBox from './components/CityInfoBox';
import CityRegistration from './components/CityRegistration';
import CityProfile from './components/CityProfile';
import CityNetworkProfile from './components/CityNetworkProfile';
import {
  City,
  ValidateTokenResponse,
  GetCitiesResponse,
  GetVotesResponse,
  VoteData
} from './backendTypes';

function CityRoute() {
  // Always show the city profile regardless of login status
  return <CityProfile />;
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
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleSubmit = () => {
    fetchData();
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

  function AuthenticatedContent() {
    const navigate = useNavigate();
    const [question, setQuestion] = useState('');
    const [isCreatingPoll, setIsCreatingPoll] = useState(false);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentError, setAttachmentError] = useState('');
    const [pollType, setPollType] = useState<'regular' | 'jointStatement'>('regular');
    const [useUrl, setUseUrl] = useState(false);
    const [documentUrl, setDocumentUrl] = useState('');
    const [urlError, setUrlError] = useState('');
    const [organisedBy, setOrganisedBy] = useState('');

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        
        if (file) {
            if (file.type !== 'application/pdf') {
                setAttachmentError('Only PDF files are allowed');
                setAttachment(null);
                return;
            }
            
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                setAttachmentError('File size must be less than 10MB');
                setAttachment(null);
                return;
            }
            
            setAttachmentError('');
            setAttachment(file);
        } else {
            setAttachment(null);
        }
    };

    // Helper function to create a URL-safe base64 SHA-256 hash
    const createAttachmentId = async (pollQuestion: string): Promise<string> => {
        // Use the SubtleCrypto API to create a SHA-256 hash
        const encoder = new TextEncoder();
        const data = encoder.encode(pollQuestion);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        
        // Convert the hash to a base64 string
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashBase64 = btoa(String.fromCharCode(...hashArray));
        
        // Make it URL-safe by replacing characters
        return hashBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };

    const handleCreatePoll = async () => {
        // Validate inputs based on poll type
        if (pollType === 'regular' && !question.trim()) {
            return; // Regular polls require a question
        }
        
        if (pollType === 'jointStatement') {
            if (useUrl) {
                // URL validation for joint statements
                if (!documentUrl.trim()) {
                    setUrlError('Document URL is required');
                    return;
                }
                
                // Basic URL validation
                try {
                    new URL(documentUrl);
                    setUrlError('');
                } catch (e) {
                    setUrlError('Please enter a valid URL');
                    return;
                }
            } else if (!attachment) {
                // PDF is required when not using URL
                return;
            }
        }
        
        setIsCreatingPoll(true);
        try {
            // Prepare the poll ID
            let basePollId = question.trim();
            if (pollType === 'jointStatement') {
                // For joint statements, handle the ID differently
                if (!basePollId || basePollId === 'Joint Statement') {
                    // If no title or default title, just use the prefix with trailing underscore
                    basePollId = 'joint_statement_';
                } else {
                    // Otherwise, add the prefix to the custom title
                    basePollId = `joint_statement_${basePollId}`;
                }
                
                // No longer need to add organised by to the poll ID
                // It will be stored in the poll metadata
            }
            
            // Handle document based on type
            if (pollType === 'jointStatement') {
                if (useUrl) {
                    // Create the poll with the URL as a separate field
                    const response = await fetch(VOTE_HOST, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'createPoll',
                            token,
                            pollId: basePollId,
                            documentUrl,
                            organisedBy: organisedBy.trim() || undefined
                        })
                    });

                    if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.message || 'Failed to create poll');
                    }

                    setIsModalOpen(false);
                    const encodedQuestion = encodeURIComponent(basePollId);
                    navigate(`/poll/${encodedQuestion}`);
                    setQuestion('');
                    setDocumentUrl('');
                    setPollType('regular'); // Reset to default
                    return;
                } else if (attachment) {
                    // For PDF-based joint statements
                    const attachmentId = await createAttachmentId(basePollId);
                    
                    // First, get the presigned URL
                    const getUrlResponse = await fetch(VOTE_HOST, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'uploadAttachment',
                            token,
                            pollId: basePollId,
                            attachmentId
                        })
                    });

                    if (!getUrlResponse.ok) {
                        const data = await getUrlResponse.json();
                        throw new Error(data.message || 'Failed to get upload URL');
                    }

                    const urlData = await getUrlResponse.json();
                    
                    if (!urlData.uploadUrl) {
                        throw new Error('No upload URL provided');
                    }
                    
                    // Then, upload the file directly to S3 using the presigned URL
                    const uploadResponse = await fetch(urlData.uploadUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/pdf'
                        },
                        body: attachment
                    });

                    if (!uploadResponse.ok) {
                        throw new Error('Failed to upload attachment to S3');
                    }
                    
                    // Use the formatted pollId returned from the backend (which includes _attachment_<hash>)
                    if (urlData.pollId) {
                        // Create the poll with the formatted pollId
                        const response = await fetch(VOTE_HOST, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                action: 'createPoll',
                                token,
                                pollId: urlData.pollId,
                                documentUrl: null,
                                organisedBy: organisedBy.trim() || undefined
                            })
                        });

                        if (!response.ok) {
                            const data = await response.json();
                            throw new Error(data.message || 'Failed to create poll');
                        }

                        setIsModalOpen(false);
                        const encodedQuestion = encodeURIComponent(urlData.pollId);
                        navigate(`/poll/${encodedQuestion}`);
                        setQuestion('');
                        setAttachment(null);
                        setOrganisedBy('');
                        setPollType('regular'); // Reset to default
                        return;
                    }
                }
            } else if (attachment) {
                // Handle regular poll with attachment
                const attachmentId = await createAttachmentId(basePollId);
                
                // First, get the presigned URL
                const getUrlResponse = await fetch(VOTE_HOST, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'uploadAttachment',
                        token,
                        pollId: basePollId,
                        attachmentId
                    })
                });

                if (!getUrlResponse.ok) {
                    const data = await getUrlResponse.json();
                    throw new Error(data.message || 'Failed to get upload URL');
                }

                const urlData = await getUrlResponse.json();
                
                if (!urlData.uploadUrl) {
                    throw new Error('No upload URL provided');
                }
                
                // Then, upload the file directly to S3 using the presigned URL
                const uploadResponse = await fetch(urlData.uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/pdf'
                    },
                    body: attachment
                });

                if (!uploadResponse.ok) {
                    throw new Error('Failed to upload attachment to S3');
                }
                
                // Use the formatted pollId returned from the backend (which includes _attachment_<hash>)
                if (urlData.pollId) {
                    // Create the poll with the formatted pollId
                    const response = await fetch(VOTE_HOST, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                    action: 'createPoll',
                    token,
                    pollId: urlData.pollId,
                    documentUrl: null,
                    organisedBy: organisedBy.trim() || undefined
                        })
                    });

                    if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.message || 'Failed to create poll');
                    }

                    setIsModalOpen(false);
                    const encodedQuestion = encodeURIComponent(urlData.pollId);
                    navigate(`/poll/${encodedQuestion}`);
                    setQuestion('');
                    setAttachment(null);
                    setPollType('regular'); // Reset to default
                    return;
                }
            }

            // If no attachment or no pollId returned, create the poll with the original question
            const response = await fetch(VOTE_HOST, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'createPoll',
                    token,
                    pollId: basePollId,
                    documentUrl: null,
                    organisedBy: organisedBy.trim() || undefined
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Failed to create poll');
            }

            setIsModalOpen(false);
            const encodedQuestion = encodeURIComponent(basePollId);
            navigate(`/poll/${encodedQuestion}`);
            setQuestion('');
            setAttachment(null);
            setPollType('regular'); // Reset to default
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to create poll');
        } finally {
            setIsCreatingPoll(false);
        }
    };

    const handleCancel = () => {
        setQuestion('');
        setAttachment(null);
        setAttachmentError('');
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
                    Create New Poll
                </DialogTitle>
                <DialogContent sx={{ px: 3, pb: 3 }}>
                    {/* Poll Type Selection */}
                    <Box sx={{ mb: 3, mt: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Poll Type
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant={pollType === 'regular' ? 'contained' : 'outlined'}
                                onClick={() => setPollType('regular')}
                                sx={{ flex: 1 }}
                            >
                                Regular Poll
                            </Button>
                            <Button
                                variant={pollType === 'jointStatement' ? 'contained' : 'outlined'}
                                onClick={() => setPollType('jointStatement')}
                                sx={{ flex: 1 }}
                            >
                                Joint Statement
                            </Button>
                        </Box>
                        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                            {pollType === 'regular' 
                                ? 'Create a standard poll with Yes/No voting options.' 
                                : 'Create a joint statement that cities can sign. Requires a PDF document.'}
                        </Typography>
                    </Box>

                    {/* Question Field */}
                    <TextField
                        fullWidth
                        label={pollType === 'regular' ? "Question" : "Statement Title"}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        margin="normal"
                        required={pollType === 'regular'}
                        helperText={pollType === 'jointStatement' ? "Optional for joint statements" : ""}
                    />

                    {/* Attachment Field */}
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            {pollType === 'regular' ? 'Attachment (Optional)' : 'Document (Required)'}
                        </Typography>
                        
                        {/* URL or PDF selection for joint statements */}
                        {pollType === 'jointStatement' && (
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                                    Choose document type:
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                        variant={!useUrl ? 'contained' : 'outlined'}
                                        size="small"
                                        onClick={() => setUseUrl(false)}
                                    >
                                        PDF Upload
                                    </Button>
                                    <Button
                                        variant={useUrl ? 'contained' : 'outlined'}
                                        size="small"
                                        onClick={() => setUseUrl(true)}
                                    >
                                        URL Link
                                    </Button>
                                </Box>
                            </Box>
                        )}
                        
                        {/* URL input field */}
                        {pollType === 'jointStatement' && useUrl && (
                            <TextField
                                fullWidth
                                label="Document URL"
                                value={documentUrl}
                                onChange={(e) => setDocumentUrl(e.target.value)}
                                margin="normal"
                                placeholder="https://example.com/document.pdf"
                                required
                                error={!!urlError}
                                helperText={urlError || "Enter the URL to the document"}
                            />
                        )}
                        
                        {/* PDF upload field */}
                        {(!useUrl || pollType === 'regular') && (
                            <>
                                <input
                                    accept="application/pdf"
                                    style={{ display: 'none' }}
                                    id="attachment-file"
                                    type="file"
                                    onChange={handleFileChange}
                                />
                                <label htmlFor="attachment-file">
                                    <Button
                                        variant="outlined"
                                        component="span"
                                        startIcon={<span className="material-icons">attach_file</span>}
                                    >
                                        {attachment ? 'Change PDF' : 'Upload PDF'}
                                    </Button>
                                </label>
                                {attachment && (
                                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                        Selected: {attachment.name} ({Math.round(attachment.size / 1024)} KB)
                                    </Typography>
                                )}
                                {attachmentError && (
                                    <Typography variant="body2" sx={{ mt: 1, color: 'error.main' }}>
                                        {attachmentError}
                                    </Typography>
                                )}
                                {pollType === 'jointStatement' && !attachment && !useUrl && (
                                    <Typography variant="body2" sx={{ mt: 1, color: 'warning.main' }}>
                                        A PDF document is required for joint statements
                                    </Typography>
                                )}
                            </>
                        )}
                    </Box>
                    
                    {/* Organised By Field (only for joint statements) */}
                    {pollType === 'jointStatement' && (
                        <TextField
                            fullWidth
                            label="Organised By"
                            value={organisedBy}
                            onChange={(e) => setOrganisedBy(e.target.value)}
                            margin="normal"
                            placeholder="Optional: Organisation or entity that organised this joint statement"
                            helperText="Optional field to indicate who organised this joint statement"
                        />
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Button 
                        onClick={handleCreatePoll}
                        disabled={
                            isCreatingPoll || 
                            (pollType === 'regular' && !question.trim()) || 
                            (pollType === 'jointStatement' && !useUrl && !attachment) ||
                            (pollType === 'jointStatement' && useUrl && !documentUrl.trim())
                        }
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
            <Route path="/polls" element={
              <Polls 
                token={token}
                cityInfo={cityInfo || undefined}
                votesData={votesData}
                cities={cities}
                onRefresh={fetchVotesOnly}
              />
            } />
            <Route path="/poll/:pollId" element={
              cityInfo ? (
                <Poll 
                  token={token} 
                  cityInfo={cityInfo} 
                  pollData={undefined}
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
                      {/* Small slogan for mobile screens */}
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          display: { xs: 'block', md: 'none' },
                          color: '#1a237e',
                          fontWeight: 300,
                          letterSpacing: '0.05em',
                          fontSize: '0.75rem',
                          fontFamily: '"Helvetica Neue", Arial, sans-serif',
                          mt: -3,
                          mb: -1,
                          opacity: 0.7,
                          textAlign: 'center'
                        }}
                      >
                        Local Government Coordination
                      </Typography>
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
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      position: 'relative'
                    }}>
                      {/* Slogan for non-mobile screens (no box) */}
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          position: 'absolute',
                          top: { xs: 0, sm: 0 },
                          zIndex: 10,
                          color: '#1a237e',
                          fontWeight: 300,
                          textAlign: 'center',
                          letterSpacing: '0.12em',
                          textTransform: 'none',
                          fontFamily: '"Helvetica Neue", Arial, sans-serif',
                          display: { xs: 'none', md: 'block' }
                        }}
                      >
                        Local Government Coordination
                      </Typography>
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
                  {/* Only show CityInfoBox for the logged-in user's own city information */}
                  <CityInfoBox 
                    cityId={cityInfo?.id || null} 
                    cityInfo={cityInfo} 
                    cities={cities} 
                    token={token}
                  />
                  
                  {/* Link to polls page */}
                  <Box sx={{ 
                    width: '100%',
                    maxWidth: 800,
                    display: 'flex',
                    justifyContent: 'center',
                    mt: 4
                  }}>
                    <Button
                      component={Link}
                      to="/polls"
                      variant="contained"
                      startIcon={<span className="material-icons">how_to_vote</span>}
                      sx={{ px: 4, py: 1.5 }}
                    >
                      View All Polls
                    </Button>
                  </Box>
                </Box>
              )
            } />
            <Route 
              path="/city/:cityId" 
              element={<CityRoute />}
            />
            <Route 
              path="/network/:networkId" 
              element={<CityNetworkProfile />}
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

export default App;
