import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { PERSONAL_AUTH_API_HOST } from '../constants';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Get email and token from URL parameters
    const emailParam = searchParams.get('email');
    const tokenParam = searchParams.get('token');

    if (!emailParam || !tokenParam) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

    setEmail(emailParam);
    setResetToken(tokenParam);
  }, [searchParams]);

  const validateForm = (): boolean => {
    if (!newPassword) {
      setError('New password is required');
      return false;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return false;
    }

    const hasUppercase = /[A-Z]/.test(newPassword);
    if (!hasUppercase) {
      setError('New password must contain at least one uppercase letter');
      return false;
    }

    const hasLowercase = /[a-z]/.test(newPassword);
    if (!hasLowercase) {
      setError('New password must contain at least one lowercase letter');
      return false;
    }

    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasNumber) {
      setError('New password must contain at least one number');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!email || !resetToken) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

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
          action: 'resetPassword',
          email,
          resetToken,
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.details || 'Failed to reset password');
      }

      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');

      // Redirect to login page after a delay
      setTimeout(() => {
        navigate('/login/user?reset=success');
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = (field: 'new' | 'confirm') => {
    if (field === 'new') {
      setShowNewPassword(!showNewPassword);
    } else {
      setShowConfirmPassword(!showConfirmPassword);
    }
  };

  // Show error if no email or token in URL
  if (!email || !resetToken) {
    return (
      <Box sx={{ py: 4, px: 2, mt: 10 }}>
        <Paper elevation={3} sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Invalid Reset Link
          </Typography>
          <Alert severity="error" sx={{ mb: 3 }}>
            This password reset link is invalid or has expired. Please request a new password reset.
          </Alert>
          <Button
            variant="contained"
            fullWidth
            onClick={() => navigate('/forgot-password')}
          >
            Request New Reset Link
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4, px: 2, mt: 10 }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 500, mx: 'auto' }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Reset Password
        </Typography>
        <Typography variant="body1" paragraph align="center" color="text.secondary">
          Enter your new password for {email}
        </Typography>

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Password reset successfully! You will be redirected to the login page.
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
                label="New Password"
                type={showNewPassword ? 'text' : 'password'}
                fullWidth
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="new-password"
                helperText="Must be at least 8 characters with uppercase, lowercase, and number"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => togglePasswordVisibility('new')}
                        edge="end"
                      >
                        {showNewPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Confirm New Password"
                type={showConfirmPassword ? 'text' : 'password'}
                fullWidth
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="new-password"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => togglePasswordVisibility('confirm')}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
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
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="outlined"
                fullWidth
                onClick={() => navigate('/login/user')}
                disabled={isSubmitting}
              >
                Back to Login
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default ResetPassword;