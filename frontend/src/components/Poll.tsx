import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Typography, Button, List, ListItem, ListItemText, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Radio, RadioGroup, FormControlLabel, FormControl } from '@mui/material';
import { VOTE_HOST } from '../constants';

// Update the interface to include capacityAs
interface Vote {
  [cityId: string]: [number, string, { 
    title: string; 
    name: string; 
    actingCapacity: 'individual' | 'representingCityAdministration' 
  }][];
}

interface PollProps {
  token: string;
  cityInfo: any;
  pollData: any;
  onVoteComplete?: () => void;
  votesData?: Record<string, Vote>;
  cities?: Record<string, any>;
}

function Poll({ token, pollData, onVoteComplete, votesData, cities, cityInfo }: PollProps) {
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

  // Remove modal-related state and handlers
  const pollVotes = votesData?.[pollData?.id || pollId] || {};

  const hasVoted = pollVotes[cityInfo?.id]?.length > 0;

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
          option,
          title: personalInfo.title,
          name: personalInfo.name,
          actingCapacity: isPersonal ? 'individual' : 'representingCityAdministration'
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

  const handleVoteClick = (option: string) => {
    setConfirmDialog({ open: true, option });
  };

  const handleConfirmVote = async () => {
    if (!confirmDialog.option) return;
    
    setConfirmDialog({ open: false, option: null });
    await handleVote(confirmDialog.option);
  };

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
          onClick={() => navigate('/')} 
          variant="outlined"
          startIcon={<span className="material-icons">arrow_back</span>}
          sx={{
            borderRadius: 2,
            px: 3
          }}
        >
          Back to Dashboard
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
              mb: 4,
              color: 'primary.main',
              textAlign: 'center',
              fontWeight: 600
            }}
          >
            {pollData?.title || decodeURIComponent(pollId || '')}
          </Typography>

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
          
          <List sx={{ 
            bgcolor: 'background.default',
            borderRadius: 2,
            p: 0,
            overflow: 'hidden'
          }}>
            {Object.entries(pollVotes).map(([cityId, votes], index) => (
              <Box key={cityId}>
                <ListItem sx={{ 
                  py: 2,
                  px: 3,
                  bgcolor: index % 2 === 0 ? 'background.default' : 'background.paper'
                }}>
                  <ListItemText
                    primary={
                      <Typography sx={{ fontWeight: 500, color: 'primary.main' }}>
                        {cities?.[cityId]?.name || cityId}
                      </Typography>
                    }
                    secondary={
                      votes.map(([timestamp, option, voteInfo], voteIndex) => (
                        <Typography
                          key={voteIndex}
                          variant="body2"
                          color="text.secondary"
                          component="div"
                          sx={{ py: 0.5 }}
                        >
                          {new Date(timestamp).toLocaleString()}: {' '}
                          <span>
                            {voteInfo.title} {voteInfo.name}
                            {' '}
                            <em>
                              ({voteInfo.actingCapacity === 'individual' ? 
                                'personal opinion' : 
                                'representing City Administration'})
                            </em>
                          </span>
                          {' voted '}
                          <strong>{option}</strong>
                        </Typography>
                      ))
                    }
                  />
                </ListItem>
                {index < Object.entries(pollVotes).length - 1 && <Divider />}
              </Box>
            ))}
          </List>

          <Dialog
            open={confirmDialog.open}
            onClose={() => setConfirmDialog({ open: false, option: null })}
          >
            <DialogTitle>Confirm Vote</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to vote "{confirmDialog.option}"{' '}
                {isPersonal ? (
                  <>as a personal vote from <strong>{personalInfo.title} {personalInfo.name}</strong></>
                ) : (
                  <>on behalf of the City Administration as <strong>{personalInfo.title} {personalInfo.name}</strong></>
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