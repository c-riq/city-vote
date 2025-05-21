import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import { PERSONAL_AUTH_API_HOST } from '../constants';

const EmailVerification: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const email = searchParams.get('email');
      const token = searchParams.get('token');

      if (!email || !token) {
        setIsVerifying(false);
        setError('Missing email or verification token');
        return;
      }

      try {
        // The verification endpoint accepts query parameters directly
        const response = await fetch(`${PERSONAL_AUTH_API_HOST}?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        const data = await response.json();

        setIsVerifying(false);

        if (!response.ok) {
          setError(data.message || data.details || 'Verification failed');
          return;
        }

        setSuccess(true);
        setMessage(data.message || 'Email verified successfully');
      } catch (err) {
        setIsVerifying(false);
        setError('An error occurred during verification. Please try again later.');
        console.error('Verification error:', err);
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <Box sx={{ py: 4, px: 2 }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Email Verification
        </Typography>

        {isVerifying ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="body1">Verifying your email...</Typography>
          </Box>
        ) : success ? (
          <>
            <Alert severity="success" sx={{ mb: 3 }}>
              {message}
            </Alert>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate('/register/city')}
              >
                Register Your City
              </Button>
              <Button
                variant="outlined"
                onClick={() => navigate('/login/user')}
              >
                Go to Login
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => navigate('/register/user')}
              >
                Back to Registration
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default EmailVerification;
