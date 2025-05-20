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
import { VOTE_HOST, PUBLIC_API_HOST, AUTOCOMPLETE_API_HOST } from '../constants';
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
  pollData?: {
    id: string;
    title: string;
    options?: string[];
  };
  onVoteComplete?: () => void;
  votesData?: VoteData;
  cities?: Record<string, City>;
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

function Poll({ token, pollData: initialPollData, onVoteComplete, votesData: propVotesData, cities: propCities, cityInfo }: PollProps) {
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
  const [pollMetadata, setPollMetadata] = useState<{
    documentUrl?: string;
    organisedBy?: string;
    createdAt?: number;
  } | null>(null);

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

  // Keep track of city IDs we've already attempted to fetch
  const [attemptedCityIds, setAttemptedCityIds] = useState<Set<string>>(new Set());
  
  // Fetch missing cities using batch lookup
  useEffect(() => {
    const fetchMissingCities = async () => {
      if (!pollId && !initialPollData) return;
      
      const currentPollId = initialPollData?.id || pollId || '';
      const pollVotes = votesData?.[currentPollId]?.votes || [];
      
      // Collect city IDs from votes
      const cityIds = pollVotes
        .filter(vote => vote.associatedCity)
        .map(vote => vote.associatedCity as string);
      
      // Find missing city IDs (those that are in votes but not in cities object)
      // and that we haven't attempted to fetch before
      const uniqueCityIds = [...new Set(cityIds)];
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
  }, [votesData, pollId, initialPollData, attemptedCityIds]);

  // Fetch poll metadata and check for attachment when poll ID is available
  useEffect(() => {
    const fetchPollData = async () => {
      if (pollId || initialPollData?.id) {
        const question = initialPollData?.id || decodeURIComponent(pollId || '');
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
        
        // Fetch poll metadata
        try {
          const metadataResponse = await fetch(`${VOTE_HOST}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'getPollMetadata',
              pollId: question,
              token: token || '' // Token may be optional for public polls
            })
          });
          
          if (metadataResponse.ok) {
            const metadataData = await metadataResponse.json();
            if (metadataData.metadata) {
              setPollMetadata(metadataData.metadata);
            } else {
              setPollMetadata(null);
            }
          } else {
            setPollMetadata(null);
          }
        } catch (error) {
          console.error('Error fetching poll metadata:', error);
          setPollMetadata(null);
        }
      }
    };
    
    fetchPollData();
  }, [pollId, initialPollData, token]);

  // Helper function to get display title and metadata
  const getDisplayTitle = (title: string): string => {
    // First check if it's a joint statement
    if (title === 'joint_statement_' || title.startsWith('joint_statement__attachment_')) {
      return 'Joint Statement';
    } else if (title.startsWith('joint_statement_')) {
      // If it has a custom title, remove the prefix
      title = title.substring('joint_statement_'.length);
    }
    
    // Remove attachment hash if present
    const attachmentIndex = title.indexOf('_attachment_');
    if (attachmentIndex !== -1) {
      title = title.substring(0, attachmentIndex);
    }
    
    // Remove URL if present
    const urlIndex = title.indexOf('_url_');
    if (urlIndex !== -1) {
      title = title.substring(0, urlIndex);
    }
    
    // Remove organised by if present
    const organisedByIndex = title.indexOf('_organised_by_');
    if (organisedByIndex !== -1) {
      title = title.substring(0, organisedByIndex);
    }
    
    return title;
  };
  
  // Helper function to extract organised by information
  const getOrganisedBy = (title: string): string | null => {
    const organisedByIndex = title.indexOf('_organised_by_');
    if (organisedByIndex !== -1) {
      // Extract everything after _organised_by_
      let organisedBy = title.substring(organisedByIndex + '_organised_by_'.length);
      
      // If there's a URL or attachment after the organised by, remove it
      const urlIndex = organisedBy.indexOf('_url_');
      if (urlIndex !== -1) {
        organisedBy = organisedBy.substring(0, urlIndex);
      }
      
      const attachmentIndex = organisedBy.indexOf('_attachment_');
      if (attachmentIndex !== -1) {
        organisedBy = organisedBy.substring(0, attachmentIndex);
      }
      
      return organisedBy;
    }
    return null;
  };
  
  // Helper function to extract document URL
  const getDocumentUrl = (title: string): string | null => {
    const urlIndex = title.indexOf('_url_');
    if (urlIndex !== -1) {
      // Extract everything after _url_
      let url = title.substring(urlIndex + '_url_'.length);
      
      // If there's an attachment after the URL, remove it
      const attachmentIndex = url.indexOf('_attachment_');
      if (attachmentIndex !== -1) {
        url = url.substring(0, attachmentIndex);
      }
      
      return decodeURIComponent(url);
    }
    return null;
  };
  
  // Check if this is a joint statement poll
  const isJointStatement = (pollId || '').startsWith('joint_statement_');

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
      const votesFetchResult = await fetch(`${PUBLIC_API_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getVotes' })
      });

      if (!votesFetchResult.ok) {
        throw new Error('Failed to fetch votes');
      }

      const votesResponse: GetVotesResponse = await votesFetchResult.json();
      
      // Set the votes data directly
      setVotesData(votesResponse?.votes || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setVotesData({});
      setCities({});
    } finally {
      setIsLoading(false);
    }
  };

  const pollVotes = votesData?.[initialPollData?.id || pollId || ''] || { votes: [] };
  const hasVoted = cityInfo?.id ? pollVotes.votes.some(vote => vote.associatedCity === cityInfo?.id) : false;

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
        pollId: initialPollData?.id || pollId || '',
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

  if (!pollId && !initialPollData) {
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
  const allVotes = pollVotes.votes ? 
    pollVotes.votes.map(vote => {
      return {
        cityId: vote.associatedCity || '',
        timestamp: vote.time || 0,
        option: vote.vote,
        voteInfo: vote.author,
        city: vote.city
      };
    }).sort((a, b) => b.timestamp - a.timestamp) : [];

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
            {getDisplayTitle(initialPollData?.title || decodeURIComponent(pollId || ''))}
          </Typography>
          
          {/* Display organised by information if available */}
          {isJointStatement && (
            (pollMetadata?.organisedBy || getOrganisedBy(initialPollData?.title || decodeURIComponent(pollId || ''))) && (
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  mb: 3,
                  textAlign: 'center',
                  color: 'text.secondary'
                }}
              >
                Organised by: {pollMetadata?.organisedBy || getOrganisedBy(initialPollData?.title || decodeURIComponent(pollId || ''))}
              </Typography>
            )
          )}
          
          {/* Display document URL if available */}
          {isJointStatement && (
            (pollMetadata?.documentUrl || getDocumentUrl(initialPollData?.title || decodeURIComponent(pollId || ''))) && (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                mb: 4,
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Document URL:
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<span className="material-icons">open_in_new</span>}
                  component={MuiLink}
                  href={pollMetadata?.documentUrl || getDocumentUrl(initialPollData?.title || decodeURIComponent(pollId || '')) || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ 
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 3
                  }}
                >
                  Open Document
                </Button>
              </Box>
            )
          )}
          
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
                {isJointStatement ? (
                  // For joint statements, only show "Sign Document" option
                  <Button
                    variant="contained"
                    onClick={() => handleVoteClick("Sign")}
                    disabled={voting || !personalInfo.title || !personalInfo.name}
                    sx={{
                      py: 1.5,
                      fontSize: '1.1rem',
                      backgroundColor: 'primary.main',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      }
                    }}
                    startIcon={<span className="material-icons">how_to_reg</span>}
                  >
                    Sign Document
                  </Button>
                ) : (
                  // For regular polls, show Yes/No options
                  (initialPollData?.options || ['Yes', 'No']).map((option: string, index: number) => (
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
                  ))
                )}
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
            <Typography variant="h6" sx={{ mb: 2 }}>
              {isJointStatement ? 'Signatures' : 'Results'}
            </Typography>
            
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
                    {isJointStatement && option === 'Sign' ? 'Signed' : option}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>
                    {count} {isJointStatement ? 'signature' : 'vote'}{count !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                {isJointStatement ? 'No signatures yet' : 'No votes yet'}
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
            {isJointStatement ? 'Signature History' : 'Voting History'}
          </Typography>
          
          <VoteList 
            votes={allVotes}
            cities={cities || {}}
            variant="list"
            isJointStatement={isJointStatement}
          />

          <Dialog
            open={confirmDialog.open}
            onClose={() => setConfirmDialog({ open: false, option: null })}
          >
            <DialogTitle>{isJointStatement ? 'Confirm Signature' : 'Confirm Vote'}</DialogTitle>
            <DialogContent>
              <Typography>
                {isJointStatement ? (
                  <>
                    Are you sure you want to sign this document{' '}
                    {isPersonal ? (
                      <>as a <strong>personal</strong> signature from {personalInfo.title} <strong>{personalInfo.name}</strong></>
                    ) : (
                      <>on <strong>behalf of the City Administration </strong> as {personalInfo.title} <strong>{personalInfo.name}</strong></>
                    )}?
                  </>
                ) : (
                  <>
                    Are you sure you want to vote "<strong>{confirmDialog.option}</strong>"{' '}
                    {isPersonal ? (
                      <>as a <strong>personal</strong> vote from {personalInfo.title} <strong>{personalInfo.name}</strong></>
                    ) : (
                      <>on <strong>behalf of the City Administration </strong> as {personalInfo.title} <strong>{personalInfo.name}</strong></>
                    )}?
                  </>
                )}
              </Typography>
              {hasVoted && !isPersonal && (
                <Typography
                  sx={{ mt: 2, color: 'warning.main' }}
                >
                  Note: {cityInfo?.name} has already {isJointStatement ? 'signed this document' : 'voted on this poll'}. 
                  This will add another {isJointStatement ? 'signature' : 'vote'} to the history.
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
                {isJointStatement ? 'Confirm Signature' : 'Confirm Vote'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}
    </Box>
  );
}

export default Poll;
