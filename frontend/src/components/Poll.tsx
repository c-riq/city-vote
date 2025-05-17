import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  CircularProgress,
  Link as MuiLink
} from '@mui/material';
import { VOTE_HOST, PUBLIC_API_HOST } from '../constants';
import VoteList from './VoteList';
import {
  City,
  VoteData,
  VoteRequest,
  GetVotesResponse,
  GetCitiesResponse
} from '../backendTypes';

interface PollProps {
  token?: string;
  cityInfo?: City;
  pollData?: any;
  onVoteComplete?: () => void;
  votesData?: VoteData;
  cities?: Record<string, City>;
  theme?: any;
}

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

function Poll({ token, pollData, onVoteComplete, votesData: propVotesData, cities: propCities, cityInfo }: PollProps) {
  const navigate = useNavigate();
  const { pollId } = useParams();
  const [error, setError] = useState('');
  const [voting, setVoting] = useState(false);
  const [isPersonal, setIsPersonal] = useState(false);
  const [personalInfo, setPersonalInfo] = useState({ title: 'Mayor', name: '' });
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; option: string | null }>({
    open: false,
    option: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [votesData, setVotesData] = useState<VoteData>(propVotesData || {});
  const [cities, setCities] = useState<Record<string, City>>(propCities || {});
  const [isAuthenticated] = useState(!!token && !!cityInfo);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  // Fetch data if not provided as props (unauthenticated mode)
  useEffect(() => {
    if (!isAuthenticated && pollId) {
      fetchData();
    }
  }, [pollId, isAuthenticated]);

  // Update local state when props change (after a vote is submitted and parent fetches new data)
  useEffect(() => {
    if (propVotesData) {
      setVotesData(propVotesData);
    }
    if (propCities) {
      setCities(propCities);
    }
  }, [propVotesData, propCities]);

  // Check for attachment when poll ID is available
  useEffect(() => {
    const checkAttachment = async () => {
      if (pollId || pollData?.id) {
        const question = pollData?.id || decodeURIComponent(pollId || '');
        const attachmentId = await createAttachmentId(question);
        
        // Request a direct URL for the attachment
        try {
          const response = await fetch(`${VOTE_HOST}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'getAttachmentUrl',
              pollId: question,
              attachmentId: attachmentId,
              token: token || '' // Token may be optional for public polls
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.attachmentUrl) {
              setAttachmentUrl(data.attachmentUrl);
            } else {
              setAttachmentUrl(null);
            }
          } else {
            setAttachmentUrl(null);
          }
        } catch (error) {
          console.error('Error checking attachment:', error);
          setAttachmentUrl(null);
        }
      }
    };
    
    checkAttachment();
  }, [pollId, pollData, token]);

  // Helper function to get display title (removes _attachment_<hash> if present)
  const getDisplayTitle = (title: string): string => {
    const attachmentIndex = title.indexOf('_attachment_');
    return attachmentIndex !== -1 ? title.substring(0, attachmentIndex) : title;
  };

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

      const citiesData: GetCitiesResponse = await citiesResponse.json();
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

  const pollVotes = votesData?.[pollData?.id || pollId] || {};
  const hasVoted = cityInfo?.id ? pollVotes[cityInfo?.id]?.length > 0 : false;

  const handleVote = async (option: string) => {
    setVoting(true);
    setError('');
    try {
      if (!token) {
        throw new Error('Authentication token is required to vote');
      }

      const voteRequest: VoteRequest = {
        action: 'vote',
        token,
        pollId: pollData?.id || pollId || '',
        option,
        title: personalInfo.title,
        name: personalInfo.name,
        actingCapacity: isPersonal ? 'individual' : 'representingCityAdministration'
      };

      const response = await fetch(VOTE_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(voteRequest)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit vote');
      }

      // Call the parent's callback which will fetch updated data
      // The useEffect hook will update local state when props change
      onVoteComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setVoting(false);
    }
  };

  const handleVoteClick = (option: string) => {
    setConfirmDialog({ open: true, option });
  };

  const handleConfirmVote = async () => {
    if (!confirmDialog.option) return;
    
    setConfirmDialog({ open: false, option: null });
    await handleVote(confirmDialog.option);
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

  if (!pollId && !pollData) {
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
          variant="h5"
          sx={{
            mb: 2,
            color: 'text.secondary',
            textAlign: 'center',
          }}
        >
          Poll not found
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/polls')}
        >
          Back to Polls
        </Button>
      </Box>
    );
  }

  // Count votes by option for the results section
  const allVotes = Object.entries(pollVotes)
    .flatMap(([cityId, votes]) => 
      votes.map(([timestamp, option, voteInfo]) => ({
        cityId,
        timestamp,
        option,
        voteInfo
      }))
    )
    .sort((a, b) => b.timestamp - a.timestamp);

  // Count votes by option
  const votesByOption: Record<string, number> = {};
  allVotes.forEach(vote => {
    votesByOption[vote.option] = (votesByOption[vote.option] || 0) + 1;
  });

  return (
    <Box sx={{ 
      mt: 4, 
      mb: 4,
      maxWidth: 800,
      mx: 'auto'
    }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        mb: 4,
        alignItems: 'center'
      }}>
        <Button 
          onClick={() => navigate(isAuthenticated ? '/' : '/polls')} 
          variant="outlined"
          startIcon={<span className="material-icons">arrow_back</span>}
          sx={{
            borderRadius: 2,
            px: 3
          }}
        >
          {isAuthenticated ? 'Back to Dashboard' : 'Back to Polls'}
        </Button>
      </Box>

      {error ? (
        <Typography 
          color="error" 
          sx={{ 
            mt: 2,
            p: 2,
            bgcolor: 'error.light',
            borderRadius: 2,
            color: 'error.contrastText'
          }}
        >
          {error}
        </Typography>
      ) : (
        <Box sx={{ 
          bgcolor: 'background.paper',
          borderRadius: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          p: 4
        }}>
          <Typography 
            variant="h4" 
            sx={{ 
              mb: 2,
              color: 'primary.main',
              textAlign: 'center',
              fontWeight: 600
            }}
          >
            {getDisplayTitle(pollData?.title || decodeURIComponent(pollId || ''))}
          </Typography>
          
          {attachmentUrl && (
            <>
              {/* Embedded PDF viewer */}
              <Box sx={{ 
                width: '100%',
                height: '500px',
                mb: 4,
                mt: 2,
                border: '1px solid rgba(0, 0, 0, 0.12)',
                borderRadius: 2,
                overflow: 'hidden'
              }}>
                <iframe
                  src={`${attachmentUrl}#toolbar=0&navpanes=0`}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  title="PDF Attachment"
                />
              </Box>
              
              {/* Button to open in new tab */}
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                mb: 4
              }}>
                <Button
                  variant="outlined"
                  startIcon={<span className="material-icons">open_in_new</span>}
                  component={MuiLink}
                  href={attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ 
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 3
                  }}
                >
                  Open PDF in New Tab
                </Button>
              </Box>
            </>
          )}

          {isAuthenticated && (
            <>
              <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>Vote as:</Typography>
                <FormControl>
                  <RadioGroup
                    value={isPersonal ? 'personal' : 'city'}
                    onChange={(e) => setIsPersonal(e.target.value === 'personal')}
                    sx={{ mb: 2 }}
                  >
                    <FormControlLabel 
                      value="city" 
                      control={<Radio />} 
                      label={<>On behalf of the City Administration of <strong>{cityInfo?.name}</strong></>}
                    />
                    <FormControlLabel 
                      value="personal"
                      control={<Radio />} 
                      label={<>As a <strong>person</strong> expressing their own opinion</>}
                    />
                  </RadioGroup>
                </FormControl>

                <Box sx={{ mt: 3, width: '100%', maxWidth: 400 }}>
                  <TextField
                    fullWidth
                    required
                    label="Title"
                    value={personalInfo.title}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, title: e.target.value }))}
                    margin="normal"
                    size="small"
                  />
                  <TextField
                    fullWidth
                    required
                    label="Name"
                    value={personalInfo.name}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, name: e.target.value }))}
                    margin="normal"
                    size="small"
                  />
                </Box>
              </Box>

              <Box sx={{ 
                display: 'flex', 
                gap: 2, 
                flexDirection: 'column', 
                mb: 6,
                maxWidth: 400,
                mx: 'auto'
              }}>
                {(pollData?.options || ['Yes', 'No']).map((option: string, index: number) => (
                  <Button
                    key={index}
                    variant="contained"
                    onClick={() => handleVoteClick(option)}
                    disabled={voting || !personalInfo.title || !personalInfo.name}
                    sx={{
                      py: 1.5,
                      fontSize: '1.1rem',
                      backgroundColor: index === 0 ? 'primary.main' : 'primary.light',
                      '&:hover': {
                        backgroundColor: index === 0 ? 'primary.dark' : 'primary.main',
                      }
                    }}
                  >
                    {option}
                  </Button>
                ))}
              </Box>
            </>
          )}

          {/* Results section */}
          <Box sx={{ 
            mb: 4, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            gap: 2
          }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Results</Typography>
            
            {Object.entries(votesByOption).length > 0 ? (
              Object.entries(votesByOption).map(([option, count]) => (
                <Box 
                  key={option}
                  sx={{
                    width: '100%',
                    maxWidth: 400,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'background.default'
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {option}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {count} vote{count !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                No votes yet
              </Typography>
            )}
          </Box>

          <Divider sx={{ mb: 4 }} />

          <Typography 
            variant="h6" 
            sx={{ 
              mb: 3,
              color: 'primary.main',
              fontWeight: 500
            }}
          >
            Voting History
          </Typography>
          
          <VoteList 
            votes={Object.entries(pollVotes)
              .flatMap(([cityId, votes]) => 
                votes.map(([timestamp, option, voteInfo]) => ({
                  cityId,
                  timestamp,
                  option,
                  voteInfo
                }))
              )
              .sort((a, b) => b.timestamp - a.timestamp)
            }
            cities={cities || {}}
            variant="list"
          />

          <Dialog
            open={confirmDialog.open}
            onClose={() => setConfirmDialog({ open: false, option: null })}
          >
            <DialogTitle>Confirm Vote</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to vote "<strong>{confirmDialog.option}</strong>"{' '}
                {isPersonal ? (
                  <>as a <strong>personal</strong> vote from {personalInfo.title} <strong>{personalInfo.name}</strong></>
                ) : (
                  <>on <strong>behalf of the City Administration </strong> as {personalInfo.title} <strong>{personalInfo.name}</strong></>
                )}?
              </Typography>
              {hasVoted && !isPersonal && (
                <Typography
                  sx={{ mt: 2, color: 'warning.main' }}
                >
                  Note: {cityInfo?.name} has already voted on this poll. This will add another vote to the history.
                </Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setConfirmDialog({ open: false, option: null })}
                color="inherit"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmVote}
                variant="contained"
                color="primary"
                autoFocus
                disabled={!personalInfo.title || !personalInfo.name}
              >
                Confirm Vote
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  );
}

export default Poll;
