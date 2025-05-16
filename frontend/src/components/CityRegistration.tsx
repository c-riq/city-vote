import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
} from '@mui/material';
import { PUBLIC_API_HOST, AUTOCOMPLETE_API_HOST } from '../constants';
import { City } from '../backendTypes';

interface AuthChannel {
  account: string;
  type: 'linkedin' | 'email';
  confidence: number;
}

interface CityAutocompleteResult {
  wikidataId: string;
  name: string;
  countryWikidataId: string;
  countryName: string;
  countryCode: string;
}

const CityRegistration: React.FC = () => {
  const [cityName, setCityName] = useState('');
  const [cityId, setCityId] = useState('');
  const [authChannels, setAuthChannels] = useState<AuthChannel[]>([
    { account: '', type: 'email', confidence: 0 }
  ]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Autocomplete state
  const [autocompleteResults, setAutocompleteResults] = useState<CityAutocompleteResult[]>([]);
  const [isLoadingAutocomplete, setIsLoadingAutocomplete] = useState(false);
  const [autocompleteInputValue, setAutocompleteInputValue] = useState('');
  const autocompleteTimeoutRef = useRef<number | null>(null);

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

  const handleAddChannel = () => {
    setAuthChannels([...authChannels, { account: '', type: 'email', confidence: 0 }]);
  };

  const handleRemoveChannel = (index: number) => {
    const newChannels = [...authChannels];
    newChannels.splice(index, 1);
    setAuthChannels(newChannels);
  };

  const handleChannelChange = (index: number, field: keyof AuthChannel, value: string | number) => {
    const newChannels = [...authChannels];
    if (field === 'type') {
      newChannels[index][field] = value as 'linkedin' | 'email';
    } else if (field === 'account') {
      newChannels[index][field] = value as string;
    }
    // Confidence is always 0, no need to handle it in this function
    setAuthChannels(newChannels);
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

    // Validate auth channels
    for (let i = 0; i < authChannels.length; i++) {
      if (!authChannels[i].account.trim()) {
        setError(`Authentication channel ${i + 1} account is required`);
        return false;
      }
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
      const cityData: Partial<City> = {
        id: cityId,
        name: cityName,
        authenticationKeyDistributionChannels: authChannels
      };

      const response = await fetch(PUBLIC_API_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          cityData
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed');
      }

      setSuccess('City registered successfully!');
      
      // Reset form
      setCityName('');
      setCityId('');
      setAuthChannels([{ account: '', type: 'email', confidence: 0 }]);
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
          Register Your City
        </Typography>
        <Typography variant="body1" paragraph align="center" color="text.secondary">
          Complete this form to register your city with the City Vote platform
        </Typography>

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
                  Select a city to display its Wikidata ID
                </Typography>
              )}
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>Authentication Channels</Divider>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Add contact information for city officials who can verify the city's identity and receive passwords for voting
              </Typography>
            </Grid>

            {authChannels.map((channel, index) => (
              <Grid item xs={12} key={index} container spacing={2}>
                <Grid item xs={12} sm={8}>
                  <TextField
                    label="Account"
                    fullWidth
                    required
                    value={channel.account}
                    onChange={(e) => handleChannelChange(index, 'account', e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Email address or LinkedIn profile"
                    autoComplete="new-password"
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth required>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={channel.type}
                      label="Type"
                      onChange={(e) => handleChannelChange(index, 'type', e.target.value)}
                      disabled={isSubmitting}
                    >
                      <MenuItem value="email">Email</MenuItem>
                      <MenuItem value="linkedin">LinkedIn</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={1} sx={{ display: 'flex', alignItems: 'center' }}>
                  {authChannels.length > 1 && (
                    <IconButton
                      onClick={() => handleRemoveChannel(index)}
                      disabled={isSubmitting}
                      color="error"
                      size="small"
                    >
                      <span className="material-icons">delete</span>
                    </IconButton>
                  )}
                </Grid>
              </Grid>
            ))}

            <Grid item xs={12}>
              <Button
                type="button"
                variant="outlined"
                startIcon={<span className="material-icons">add</span>}
                onClick={handleAddChannel}
                disabled={isSubmitting}
                sx={{ mt: 1 }}
              >
                Add Channel
              </Button>
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
                    Registering...
                  </>
                ) : (
                  'Register City'
                )}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default CityRegistration;
