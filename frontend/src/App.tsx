import { Button, Container, Typography, TextField, Box } from '@mui/material';
import { useState } from 'react';
import { VOTE_HOST } from './constants';

function App() {
  const [token, setToken] = useState('');
  const [cityInfo, setCityInfo] = useState<any>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
          {/* Add more city information display here */}
          <Button 
            variant="outlined" 
            onClick={() => {
              setCityInfo(null);
              setToken('');
            }}
          >
            Logout
          </Button>
        </Box>
      )}
    </Container>
  );
}

export default App;