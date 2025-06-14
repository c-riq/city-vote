import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { PERSONAL_AUTH_API_HOST } from '../constants';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Invalid email format');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(PERSONAL_AUTH_API_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'forgotPassword',
          email
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.details || 'Failed to send reset email');
      }

      setSuccess(true);
      setEmail('');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ py: 4, px: 2, mt: 10 }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Forgot Password
        </Typography>
        <Typography variant="body1" paragraph align="center" color="text.secondary">
          Enter your email address and we'll send you a link to reset your password
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            If an account with that email exists, a password reset link has been sent. Please check your email.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                autoComplete="email"
              />
            </Grid>

            <Grid item xs={12} sx={{ mt: 2 }}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={isSubmitting}
                sx={{ py: 1.5 }}
              >
                {isSubmitting ? (
                  <>
                    <CircularProgress size={24} sx={{ mr: 1 }} />
                    Sending Reset Link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </Grid>
          </Grid>
        </form>

        <Divider sx={{ my: 3 }} />
        
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Remember your password?
          </Typography>
          <Button
            variant="outlined"
            onClick={() => navigate('/login/user')}
            sx={{ minWidth: 200 }}
          >
            Back to Login
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ForgotPassword;