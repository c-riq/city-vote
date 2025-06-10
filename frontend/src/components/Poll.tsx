import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  Box,
  Button,
  Typography,
  CircularProgress
} from '@mui/material';
import { VOTE_HOST, PUBLIC_API_HOST, PUBLIC_DATA_BUCKET_URL, PERSONAL_AUTH_API_HOST } from '../constants';
import useCityData from '../hooks/useCityData';
import {
  City,
  VoteData,
  VoteRequest,
  GetVotesResponse
} from '../backendTypes';
import { getDisplayTitle, isJointStatement } from '../utils/pollFormat';
import PollHeader from './poll/PollHeader';
import PollAttachment from './poll/PollAttachment';
import VoteForm from './poll/VoteForm';
import VoteButtons from './poll/VoteButtons';
import ResultsSection from './poll/ResultsSection';
import ConfirmVoteDialog from './poll/ConfirmVoteDialog';

interface PollProps {
  pollData?: {
    id: string;
    title: string;
    options?: string[];
  };
  onVoteComplete?: () => void;
  votesData?: VoteData;
  isLoadingVotes?: boolean;
}

function Poll({ pollData: initialPollData, onVoteComplete, votesData: propVotesData, isLoadingVotes: propIsLoadingVotes }: PollProps) {
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
  const [isLoadingVotes, setIsLoadingVotes] = useState(!propVotesData && !!pollId);
  
  const effectiveIsLoadingVotes = propIsLoadingVotes !== undefined ? propIsLoadingVotes : isLoadingVotes;
  const [votesData, setVotesData] = useState<VoteData>(propVotesData || {});
  
  // Check for personal authentication instead of city-based authentication
  const [userSessionToken] = useState(() => {
    const token = localStorage.getItem('userSessionToken');
    const email = localStorage.getItem('userEmail');
    
    // Clean up stale authentication data if token is missing but email exists
    if (!token && email) {
      localStorage.removeItem('userEmail');
    }
    
    return token;
  });
  const [userEmail] = useState(() => localStorage.getItem('userEmail'));
  const [isAuthenticated] = useState(!!userSessionToken && !!userEmail);
  const [userCityInfo, setUserCityInfo] = useState<City | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  
  // Use the city data hook to manage cities
  const {
    cities,
    fetchAllCities,
    isLoading: isCitiesLoading,
    error: cityError
  } = useCityData(votesData);

  // Fetch user's city information when authenticated
  useEffect(() => {
    const fetchUserCityInfo = async () => {
      if (!isAuthenticated || !userSessionToken || !userEmail) return;
      
      try {
        const response = await fetch(`${PERSONAL_AUTH_API_HOST}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userSessionToken}`
          },
          body: JSON.stringify({
            action: 'verifySessionToken',
            email: userEmail
          })
        });

        if (response.ok) {
          const userData = await response.json();
          
          if (userData.cityAssociations && userData.cityAssociations.length > 0) {
            // Use the first city association for now
            const cityAssociation = userData.cityAssociations[0];
            setUserCityInfo({
              id: cityAssociation.cityId,
              name: cityAssociation.title || 'Unknown City',
              authenticationKeyDistributionChannels: [],
              population: 0,
              country: '',
              lat: 0,
              lon: 0
            });
          } else {
            setUserCityInfo(null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user city info:', error);
      }
    };

    fetchUserCityInfo();
  }, [isAuthenticated, userSessionToken, userEmail]);

  const fetchData = useCallback(async () => {
    setError('');
    setIsLoading(true);
    setIsLoadingVotes(true);
    
    try {
      // Fetch cities data using the hook
      await fetchAllCities();

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
    } finally {
      setIsLoading(false);
      setIsLoadingVotes(false);
    }
  }, [fetchAllCities]);

  useEffect(() => {
    if (pollId && !propVotesData && !isLoading) {
      setIsLoadingVotes(true);
      fetchData();
    } else if (propVotesData) {
      setIsLoadingVotes(false);
    }
  }, [pollId, propVotesData, isLoading, fetchData]);

  useEffect(() => {
    if (propVotesData) {
      setVotesData(propVotesData);
      setIsLoadingVotes(false);
    }
  }, [propVotesData]);
  
  // Update error state if city error occurs
  useEffect(() => {
    if (cityError) {
      setError(cityError);
    }
  }, [cityError]);

  // Set attachment URL when poll ID is available
  useEffect(() => {
    if (pollId || initialPollData?.id) {
      const question = initialPollData?.id || decodeURIComponent(pollId || '');
      
      // If the poll ID contains a hash, we can construct the direct URL
      if (question.includes('_attachment_')) {
        const hash = question.split('_attachment_')[1];
        const directUrl = `${PUBLIC_DATA_BUCKET_URL}/attachments/${hash}.pdf`;
        setAttachmentUrl(directUrl);
      } else {
        setAttachmentUrl(null);
      }
    }
  }, [pollId, initialPollData]);
  
  // Check if this is a joint statement poll
  const currentPollId = initialPollData?.id || (pollId ? decodeURIComponent(pollId) : '');
  const isJointStatementPoll = isJointStatement(currentPollId);


  const pollVotes = votesData?.[initialPollData?.id || pollId || ''] || { votes: [] };
  // For personal authentication, check if the current user has voted by checking vote author info
  // Since we don't have a direct user ID in votes yet, we'll use email/name combination
  const hasVoted = userEmail ? pollVotes.votes.some(vote =>
    vote.author?.name === personalInfo.name && vote.author?.title === personalInfo.title
  ) : false;

  const handleVote = async (option: string) => {
    setVoting(true);
    setError('');
    try {
      if (!userSessionToken || !userEmail) {
        throw new Error('Please log in to vote');
      }

      // Create token in the new format: email:sessionToken
      const authToken = `${userEmail}:${userSessionToken}`;

      const voteRequest: VoteRequest = {
        action: 'vote',
        token: authToken,
        pollId: initialPollData?.id || pollId || '',
        option,
        title: personalInfo.title,
        name: personalInfo.name,
        actingCapacity: isPersonal ? 'individual' : 'representingCityAdministration',
        organisationNameFallback: userCityInfo?.name || ''
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

      setIsLoadingVotes(true);
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
        cityId: vote.associatedCityId || '',
        timestamp: vote.time || 0,
        option: vote.vote,
        voteInfo: {
          ...vote.author,
          externalVerificationSource: vote.externalVerificationSource,
          // Include city association information if available
          cityAssociation: vote.cityAssociation
        },
        city: vote.organisationNameFallback
      };
    }).sort((a, b) => b.timestamp - a.timestamp) : [];

  // Count votes by option
  const votesByOption: Record<string, number> = {};
  allVotes.forEach(vote => {
    votesByOption[vote.option] = (votesByOption[vote.option] || 0) + 1;
  });

  // Get the display title
  const displayTitle = getDisplayTitle(initialPollData?.title || decodeURIComponent(pollId || ''));

  // Get organised by and document URL from poll data
  const organisedBy = pollVotes?.organisedBy || null;
  const documentUrl = pollVotes?.URL || null;

  return (
    <Box sx={{
      mt: 10, // Increased top margin to account for header
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
          <PollHeader 
            title={displayTitle}
            isJointStatement={isJointStatementPoll}
            organisedBy={organisedBy}
            documentUrl={documentUrl}
          />
          
          {attachmentUrl && (
            <PollAttachment attachmentUrl={attachmentUrl} />
          )}

          {isAuthenticated && userCityInfo ? (
            <>
              <VoteForm
                cityInfo={userCityInfo}
                isPersonal={isPersonal}
                setIsPersonal={setIsPersonal}
                personalInfo={personalInfo}
                setPersonalInfo={setPersonalInfo}
              />

              <VoteButtons
                isJointStatement={isJointStatementPoll}
                options={initialPollData?.options || ['Yes', 'No']}
                onVote={handleVoteClick}
                disabled={voting || !personalInfo.title || !personalInfo.name}
                isVoting={voting}
              />
            </>
          ) : isAuthenticated && !userCityInfo ? (
            <Box sx={{
              textAlign: 'center',
              py: 3,
              px: 2,
              backgroundColor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="h6" gutterBottom>
                Register Your City
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                To vote on this poll, you need to register your city first.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                component={Link}
                to="/register/city"
                sx={{ mt: 1 }}
              >
                Register City
              </Button>
            </Box>
          ) : (
            <Box sx={{
              textAlign: 'center',
              py: 3,
              px: 2,
              backgroundColor: 'background.paper',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider'
            }}>
              <Typography variant="h6" gutterBottom>
                {isJointStatementPoll ? 'Login to sign this statement' : 'Login to vote in this poll'}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                You need to be logged in to vote on this poll.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                component={Link}
                to="/login/user"
                sx={{ mt: 1 }}
              >
                Login
              </Button>
            </Box>
          )}

          <ResultsSection
            votesByOption={votesByOption}
            allVotes={allVotes}
            cities={cities}
            isJointStatement={isJointStatementPoll}
            isLoadingVotes={effectiveIsLoadingVotes}
          />

          <ConfirmVoteDialog
            open={confirmDialog.open}
            option={confirmDialog.option}
            isPersonal={isPersonal}
            personalInfo={personalInfo}
            isJointStatement={isJointStatementPoll}
            hasVoted={hasVoted}
            cityInfo={userCityInfo}
            onClose={() => setConfirmDialog({ open: false, option: null })}
            onConfirm={handleConfirmVote}
          />
        </Box>
      )}
    </Box>
  );
}

export default Poll;
