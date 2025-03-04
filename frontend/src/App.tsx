import { Button, Container, Typography, TextField, Box } from '@mui/material';
import { useState } from 'react';
import { VOTE_HOST } from './constants';

function App() {
  const [token, setToken] = useState('');
  const [cityInfo, setCityInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [votesData, setVotesData] = useState<Record<string, Record<string, [number, number][]>>>({});

  const fetchVotes = async () => {
    try {
      const response = await fetch(VOTE_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getVotes',
          token
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch votes');
      }

      setVotesData(data.votes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch votes');
    }
  };

  const handleSubmit = async () => {
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

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.details || 'Authentication failed');
      }

      setCityInfo(data.city);
      await fetchVotes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to authenticate');
      setCityInfo(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      {!cityInfo ? (
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2
          }}
        >
          <Typography variant="h4">Please enter your access token</Typography>
          <TextField
            label="Access Token"
            variant="outlined"
            fullWidth
            sx={{ maxWidth: 400 }}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            error={!!error}
          />
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
                width: '100%'
              }}
            >
              {error}
            </Typography>
          )}
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Validating...' : 'Submit'}
          </Button>
        </Box>
      ) : (
        <Box
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2
          }}
        >
          <Typography variant="h4">Welcome, {cityInfo.name}!</Typography>
          <Typography>Population: {cityInfo.population}</Typography>
          
          {/* Votes Display */}
          <Typography variant="h5" sx={{ mt: 4 }}>Voting History</Typography>
          {Object.keys(votesData).length > 0 ? (
            Object.entries(votesData).map(([pollId, citiesVotes]) => (
              <Box 
                key={pollId} 
                sx={{ 
                  width: '100%',
                  maxWidth: 600,
                  bgcolor: 'background.paper',
                  p: 2,
                  borderRadius: 1,
                  boxShadow: 1,
                  mb: 2
                }}
              >
                <Typography variant="h6">Poll ID: {pollId}</Typography>
                {Object.entries(citiesVotes).map(([cityId, votes]) => (
                  <Box key={cityId} sx={{ mt: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      City: {cityId}
                    </Typography>
                    {votes.map(([timestamp, option], index) => (
                      <Typography key={index} sx={{ ml: 2 }}>
                        {new Date(timestamp).toLocaleString()}: Voted {option === 1 ? 'Yes' : 'No'}
                      </Typography>
                    ))}
                  </Box>
                ))}
              </Box>
            ))
          ) : (
            <Typography color="text.secondary">No voting history available</Typography>
          )}

          <Button 
            variant="outlined" 
            onClick={() => {
              setCityInfo(null);
              setToken('');
              setVotesData({});
            }}
            sx={{ mt: 2 }}
          >
            Logout
          </Button>
        </Box>
      )}
    </Container>
  );
}

export default App;