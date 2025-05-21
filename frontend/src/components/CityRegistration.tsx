import React, { useState, useEffect, useRef } from 'react';
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
  Autocomplete,
} from '@mui/material';
import { PERSONAL_AUTH_API_HOST, AUTOCOMPLETE_API_HOST } from '../constants';

interface CityAutocompleteResult {
  wikidataId: string;
  name: string;
  countryWikidataId: string;
  countryName: string;
  countryCode: string;
}

const CityRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [cityName, setCityName] = useState('');
  const [cityId, setCityId] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

  // Autocomplete state
  const [autocompleteResults, setAutocompleteResults] = useState<CityAutocompleteResult[]>([]);
  const [isLoadingAutocomplete, setIsLoadingAutocomplete] = useState(false);
  const [autocompleteInputValue, setAutocompleteInputValue] = useState('');
  const autocompleteTimeoutRef = useRef<number | null>(null);
  
  // Check if user is logged in
  useEffect(() => {
    const userSessionToken = localStorage.getItem('userSessionToken');
    const userEmail = localStorage.getItem('userEmail');
    
    if (!userSessionToken || !userEmail) {
      // User is not logged in, redirect to user registration immediately
      navigate('/register/user');
    } else {
      setIsUserLoggedIn(true);
    }
  }, [navigate]);

  // Fetch autocomplete results when the user types in the city name field
  const fetchAutocompleteResults = async (query: string) => {
    if (!query || query.length < 2) {
      setAutocompleteResults([]);
      return;
    }

    setIsLoadingAutocomplete(true);

    try {
      const response = await fetch(AUTOCOMPLETE_API_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'autocomplete',
          query,
          limit: 10
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Autocomplete error:', data.message || 'Failed to fetch autocomplete results');
        setAutocompleteResults([]);
        return;
      }

      setAutocompleteResults(data.results || []);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setAutocompleteResults([]);
    } finally {
      setIsLoadingAutocomplete(false);
    }
  };

  // Debounce the autocomplete API calls
  useEffect(() => {
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }

    if (autocompleteInputValue.length >= 2) {
      autocompleteTimeoutRef.current = setTimeout(() => {
        fetchAutocompleteResults(autocompleteInputValue);
      }, 300);
    } else {
      setAutocompleteResults([]);
    }

    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
      }
    };
  }, [autocompleteInputValue]);

  // Handle selection of a city from autocomplete results
  const handleCitySelect = (city: CityAutocompleteResult | null) => {
    if (city) {
      setCityName(city.name);
      setCityId(city.wikidataId);
    }
  };

  const validateForm = (): boolean => {
    if (!cityName.trim()) {
      setError('City name is required');
      return false;
    }
    if (!cityId.trim()) {
      setError('City ID is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const userEmail = localStorage.getItem('userEmail');
      const userSessionToken = localStorage.getItem('userSessionToken');
      
      if (!userEmail || !userSessionToken) {
        throw new Error('You must be logged in to submit a city registration request');
      }

      const response = await fetch(PERSONAL_AUTH_API_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userSessionToken}`
        },
        body: JSON.stringify({
          action: 'registerCity',
          email: userEmail,
          cityId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed');
      }

      setSuccess('Registration request submitted successfully. After manual verification, the city will be added to the system.');
      
      // Reset form
      setCityName('');
      setCityId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ py: 4, px: 2 }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          City Registration Request
        </Typography>
        <Typography variant="body1" paragraph align="center" color="text.secondary">
          Complete this form to submit a registration request for your city with the City Vote platform
        </Typography>
        
        {isUserLoggedIn && (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 3 }}>
                {success}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Next Steps:</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Please write a brief email to <strong>info@rixdata.net</strong> to start the verification process.
                    Include your city name and any additional information that might help verify your city's identity.
                  </Typography>
                </Box>
              </Alert>
            )}

            <form onSubmit={handleSubmit} autoComplete="off">
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }}>City Information</Divider>
                </Grid>

                <Grid item xs={12}>
                  <Autocomplete
                    fullWidth
                    options={autocompleteResults}
                    getOptionLabel={(option) => `${option.name}, ${option.countryCode}`}
                    loading={isLoadingAutocomplete}
                    onInputChange={(_, newInputValue) => {
                      setAutocompleteInputValue(newInputValue);
                    }}
                    onChange={(_, newValue) => {
                      handleCitySelect(newValue);
                    }}
                    isOptionEqualToValue={(option, value) => option.wikidataId === value.wikidataId}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="City Name"
                        required
                        fullWidth
                        disabled={isSubmitting}
                        autoComplete="new-password"
                        name={`city-name-${Math.random().toString(36).substring(2, 15)}`}
                        inputProps={{
                          ...params.inputProps,
                          autoComplete: "new-password",
                          autoCorrect: "off",
                          autoCapitalize: "off",
                          spellCheck: "false"
                        }}
                        InputProps={{
                          ...params.InputProps,
                          autoComplete: "new-password",
                          endAdornment: (
                            <>
                              {isLoadingAutocomplete ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    noOptionsText="No cities found"
                    loadingText="Loading cities..."
                    disabled={isSubmitting}
                  />
                </Grid>

                <Grid item xs={12}>
                  {cityId ? (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">City ID (Wikidata):</Typography>
                      <Typography variant="body1">
                        <a 
                          href={`https://www.wikidata.org/wiki/${cityId}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          {cityId}
                        </a>
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Select a city to submit a registration request. Email info@rixdata.net if a city cannot be found.
                    </Typography>
                  )}
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
                        Submitting...
                      </>
                    ) : (
                      'Submit Registration Request'
                    )}
                  </Button>
                </Grid>
              </Grid>
            </form>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default CityRegistration;
