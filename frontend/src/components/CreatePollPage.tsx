import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Button, 
  CircularProgress,
  Alert
} from '@mui/material';
import CreatePollDialog from './CreatePollDialog';
import { PERSONAL_AUTH_API_HOST } from '../constants';
import { City } from '../backendTypes';

function CreatePollPage() {
  const navigate = useNavigate();
  const [userSessionToken, setUserSessionToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userCityInfo, setUserCityInfo] = useState<City | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  useEffect(() => {
    const checkAuthentication = async () => {
      const token = localStorage.getItem('userSessionToken');
      const email = localStorage.getItem('userEmail');
      
      // Clean up stale authentication data if token is missing but email exists
      if (!token && email) {
        localStorage.removeItem('userEmail');
      }
      
      setUserSessionToken(token);
      setUserEmail(email);
      
      const authenticated = !!token && !!email;
      setIsAuthenticated(authenticated);
      
      if (authenticated) {
        await fetchUserCityInfo(token, email);
      }
      
      setIsLoading(false);
    };

    const fetchUserCityInfo = async (token: string, email: string) => {
      try {
        const response = await fetch(`${PERSONAL_AUTH_API_HOST}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            action: 'verifySessionToken',
            email: email
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
        setError('Failed to verify authentication');
      }
    };

    checkAuthentication();
  }, []);

  const handleCreatePoll = () => {
    setShowCreateDialog(true);
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 'calc(100vh - 200px)',
          mt: 10
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{
        p: 4,
        mt: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 600,
        mx: 'auto'
      }}>
        <Alert severity="error">{error}</Alert>
        <Button
          variant="contained"
          onClick={() => navigate('/polls')}
          sx={{ mt: 2 }}
        >
          Back to Polls
        </Button>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{
        p: 4,
        mt: 10,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 600,
        mx: 'auto'
      }}>
        <Typography variant="h4" gutterBottom>
          Authentication Required
        </Typography>
        <Typography variant="body1" paragraph>
          You need to be logged in to create a poll.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/login/user')}
          >
            Login
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/polls')}
          >
            Back to Polls
          </Button>
        </Box>
      </Box>
    );
  }

  if (!userCityInfo) {
    return (
      <Box sx={{
        p: 4,
        mt: 10,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 600,
        mx: 'auto'
      }}>
        <Typography variant="h4" gutterBottom>
          City Association Required
        </Typography>
        <Typography variant="body1" paragraph>
          You need to have a city association to create a poll.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/register/city')}
          >
            Register Your City
          </Button>
          <Button
            variant="outlined"
            onClick={() => navigate('/polls')}
          >
            Back to Polls
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      p: 4,
      mt: 10,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      maxWidth: 800,
      mx: 'auto'
    }}>
      <Typography variant="h4" gutterBottom textAlign="center">
        Create New Poll
      </Typography>
      
      <Typography variant="body1" paragraph textAlign="center" sx={{ mb: 4 }}>
        You are creating a poll as: <strong>{userCityInfo.name}</strong>
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreatePoll}
          size="large"
        >
          Create Poll
        </Button>
        <Button
          variant="outlined"
          onClick={() => navigate('/polls')}
          size="large"
        >
          Cancel
        </Button>
      </Box>

      {showCreateDialog && userSessionToken && userEmail && (
        <CreatePollDialog
          isOpen={showCreateDialog}
          onClose={handleCloseDialog}
          userSessionToken={userSessionToken}
          userEmail={userEmail}
        />
      )}
    </Box>
  );
}

export default CreatePollPage;