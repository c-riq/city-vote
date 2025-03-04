import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography, Button, List, ListItem, ListItemText, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
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
  const [isModalOpen, setIsModalOpen] = useState(!pollData);
  const [question, setQuestion] = useState(pollData ? '' : decodeURIComponent(pollId || ''));

  // Get votes for this specific poll - use pollData.id or URL pollId
  const pollVotes = votesData?.[pollData?.id || pollId] || {};

  const handleVote = async (option: number) => {
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

  const handleCreatePoll = () => {
    if (question.trim()) {
      setIsModalOpen(false);
      navigate(`/poll/${encodeURIComponent(question)}`);
    }
  };

  return (
    <Box sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button onClick={() => navigate('/')} variant="outlined">
          Back to Dashboard
        </Button>
        <Button onClick={() => setIsModalOpen(true)} variant="contained" color="primary">
          Create New Poll
        </Button>
      </Box>

      {/* Question Input Modal */}
      <Dialog open={isModalOpen} onClose={() => navigate('/')}>
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
          <Button onClick={() => navigate('/')}>Cancel</Button>
          <Button 
            onClick={handleCreatePoll}
            disabled={!question.trim()}
          >
            Create Poll
          </Button>
        </DialogActions>
      </Dialog>

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
                onClick={() => handleVote(index)}
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
                      <>
                        {votes.map(([timestamp, option], index) => (
                          <Typography 
                            key={index} 
                            variant="body2" 
                            color="text.secondary"
                            component="div"
                            sx={{ display: 'block' }}
                          >
                            {new Date(timestamp).toLocaleString()}: Voted {pollData?.options?.[option] || option}
                          </Typography>
                        ))}
                      </>
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