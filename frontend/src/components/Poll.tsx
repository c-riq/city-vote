import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  Box,
  Button,
  Typography,
  CircularProgress
} from '@mui/material';
import { VOTE_HOST, PUBLIC_API_HOST, PUBLIC_DATA_BUCKET_URL } from '../constants';
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
  token?: string;
  cityInfo?: City;
  pollData?: {
    id: string;
    title: string;
    options?: string[];
  };
  onVoteComplete?: () => void;
  votesData?: VoteData;
}

function Poll({ token, pollData: initialPollData, onVoteComplete, votesData: propVotesData, cityInfo }: PollProps) {
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
  const [isAuthenticated] = useState(!!token && !!cityInfo);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  
  // Use the city data hook to manage cities
  const { 
    cities, 
    fetchAllCities, 
    isLoading: isCitiesLoading, 
    error: cityError 
  } = useCityData(votesData);

  const fetchData = useCallback(async () => {
    setError('');
    setIsLoading(true);
    
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
    }
  }, [fetchAllCities]);

  // Fetch data if not provided as props (unauthenticated mode)
  useEffect(() => {
    // Only fetch data if we have a poll ID, don't have votes data from props,
    // and we're not already loading data
    if (pollId && !propVotesData && !isLoading) {
      fetchData();
    }
  }, [pollId, propVotesData, isLoading, fetchData]);

  // Update local state when props change (after a vote is submitted and parent fetches new data)
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
  const hasVoted = cityInfo?.id ? pollVotes.votes.some(vote => vote.associatedCityId === cityInfo?.id) : false;

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
        externalVerificationSource: vote.externalVerificationSource
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
          <PollHeader 
            title={displayTitle}
            isJointStatement={isJointStatementPoll}
            organisedBy={organisedBy}
            documentUrl={documentUrl}
          />
          
          {attachmentUrl && (
            <PollAttachment attachmentUrl={attachmentUrl} />
          )}

          {isAuthenticated && cityInfo ? (
            <>
              <VoteForm 
                cityInfo={cityInfo}
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
              />
            </>
          ) : (
            <Box sx={{ 
              mt: 4, 
              mb: 4, 
              p: 3, 
              bgcolor: 'action.hover', 
              borderRadius: 2,
              textAlign: 'center'
            }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Want to vote or sign this poll?
              </Typography>
              <Typography variant="body1" sx={{ mb: 3 }}>
                You need to register and log in to participate in this poll.
              </Typography>
              <Button 
                variant="contained" 
                color="primary"
                component={Link}
                to="/register"
                startIcon={<span className="material-icons">how_to_reg</span>}
                sx={{ px: 3, py: 1 }}
              >
                Register Now
              </Button>
            </Box>
          )}

          <ResultsSection 
            votesByOption={votesByOption}
            allVotes={allVotes}
            cities={cities}
            isJointStatement={isJointStatementPoll}
          />

          <ConfirmVoteDialog
            open={confirmDialog.open}
            option={confirmDialog.option}
            isPersonal={isPersonal}
            personalInfo={personalInfo}
            isJointStatement={isJointStatementPoll}
            hasVoted={hasVoted}
            cityInfo={cityInfo}
            onClose={() => setConfirmDialog({ open: false, option: null })}
            onConfirm={handleConfirmVote}
          />
        </Box>
      )}
    </Box>
  );
}

export default Poll;
