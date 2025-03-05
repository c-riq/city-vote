import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography, Button, List, ListItem, ListItemText, Divider } from '@mui/material';
import { VOTE_HOST } from '../constants';

interface PollProps {
  token: string;
  cityInfo: any;
  pollData: any;
  onVoteComplete?: () => void;
  votesData?: Record<string, Record<string, [number, number][]>>;
  cities?: Record<string, any>;
}

function Poll({ token, pollData, onVoteComplete, votesData, cities }: PollProps) {
  const navigate = useNavigate();
  const { pollId } = useParams();
  const [error, setError] = useState('');
  const [voting, setVoting] = useState(false);

  // Remove modal-related state and handlers
  const pollVotes = votesData?.[pollData?.id || pollId] || {};

  const handleVote = async (option: string) => {
    setVoting(true);
    setError('');
    try {
      const response = await fetch(VOTE_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'vote',
          token,
          pollId: pollData?.id || pollId,
          option
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit vote');
      }

      // Notify parent component to refresh data
      onVoteComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit vote');
    } finally {
      setVoting(false);
    }
  };

  return (
    <Box sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button onClick={() => navigate('/')} variant="outlined">
          Back to Dashboard
        </Button>
      </Box>

      {error ? (
        <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>
      ) : (
        <Box>
          <Typography variant="h4" sx={{ mb: 2 }}>
            {pollData?.title || decodeURIComponent(pollId || '')}
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column', mb: 4 }}>
            {(pollData?.options || ['Yes', 'No']).map((option: string, index: number) => (
              <Button
                key={index}
                variant="contained"
                onClick={() => handleVote(option)}
                disabled={voting}
              >
                {option}
              </Button>
            ))}
          </Box>

          <Typography variant="h6" sx={{ mb: 2 }}>Voting History</Typography>
          <List>
            {Object.entries(pollVotes).map(([cityId, votes]) => (
              <Box key={cityId}>
                <ListItem>
                  <ListItemText
                    primary={cities?.[cityId]?.name || cityId}
                    secondary={
                      <Box component="div">
                        {votes.map(([timestamp, option], index) => (
                          <Typography
                            key={index}
                            variant="body2"
                            color="text.secondary"
                            component="span"
                            sx={{ display: 'block' }}
                          >
                            {new Date(timestamp).toLocaleString()}: Voted {option}
                          </Typography>
                        ))}
                      </Box>
                    }
                  />
                </ListItem>
                <Divider />
              </Box>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}

export default Poll; 