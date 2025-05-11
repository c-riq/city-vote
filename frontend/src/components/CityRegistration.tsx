import React, { useState } from 'react';
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
} from '@mui/material';
import { PUBLIC_API_HOST } from '../constants';
import { City } from '../voteBackendTypes';

interface AuthChannel {
  account: string;
  type: 'linkedin' | 'email';
  confidence: number;
}

const CityRegistration: React.FC = () => {
  const [registrationCode, setRegistrationCode] = useState('');
  const [cityName, setCityName] = useState('');
  const [country, setCountry] = useState('');
  const [population, setPopulation] = useState<number | ''>('');
  const [lat, setLat] = useState<number | ''>('');
  const [lon, setLon] = useState<number | ''>('');
  const [authChannels, setAuthChannels] = useState<AuthChannel[]>([
    { account: '', type: 'email', confidence: 0.9 }
  ]);
  const [cityId, setCityId] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [token, setToken] = useState('');

  const handleAddChannel = () => {
    setAuthChannels([...authChannels, { account: '', type: 'email', confidence: 0.9 }]);
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
    } else if (field === 'confidence') {
      newChannels[index][field] = Number(value);
    } else {
      newChannels[index][field] = value as string;
    }
    setAuthChannels(newChannels);
  };

  const validateForm = (): boolean => {
    if (!registrationCode.trim()) {
      setError('Registration code is required');
      return false;
    }
    if (!cityName.trim()) {
      setError('City name is required');
      return false;
    }
    if (!country.trim()) {
      setError('Country is required');
      return false;
    }
    if (!cityId.trim()) {
      setError('City ID is required');
      return false;
    }
    if (population === '' || isNaN(Number(population)) || Number(population) < 0) {
      setError('Valid population is required');
      return false;
    }
    if (lat === '' || isNaN(Number(lat)) || Number(lat) < -90 || Number(lat) > 90) {
      setError('Valid latitude is required (between -90 and 90)');
      return false;
    }
    if (lon === '' || isNaN(Number(lon)) || Number(lon) < -180 || Number(lon) > 180) {
      setError('Valid longitude is required (between -180 and 180)');
      return false;
    }

    // Validate auth channels
    for (let i = 0; i < authChannels.length; i++) {
      if (!authChannels[i].account.trim()) {
        setError(`Authentication channel ${i + 1} account is required`);
        return false;
      }
      if (authChannels[i].confidence < 0 || authChannels[i].confidence > 1) {
        setError(`Authentication channel ${i + 1} confidence must be between 0 and 1`);
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
      const cityData: City = {
        id: cityId,
        name: cityName,
        population: Number(population),
        country,
        lat: Number(lat),
        lon: Number(lon),
        authenticationKeyDistributionChannels: authChannels
      };

      const response = await fetch(PUBLIC_API_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          registrationCode,
          cityData
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Registration failed');
      }

      setSuccess('City registered successfully!');
      setToken(data.token || '');
      
      // Reset form
      setRegistrationCode('');
      setCityName('');
      setCountry('');
      setPopulation('');
      setLat('');
      setLon('');
      setCityId('');
      setAuthChannels([{ account: '', type: 'email', confidence: 0.9 }]);
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
            {token && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2">Your city access token:</Typography>
                <TextField
                  fullWidth
                  value={token}
                  variant="outlined"
                  size="small"
                  InputProps={{
                    readOnly: true,
                  }}
                  sx={{ mt: 1, backgroundColor: 'rgba(0, 0, 0, 0.04)' }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Please save this token securely. You will need it to access your city's dashboard.
                </Typography>
              </Box>
            )}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                label="Registration Code"
                fullWidth
                required
                value={registrationCode}
                onChange={(e) => setRegistrationCode(e.target.value)}
                disabled={isSubmitting}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>City Information</Divider>
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="City ID (Wikidata ID)"
                fullWidth
                required
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                disabled={isSubmitting}
                helperText="Enter the Wikidata ID for your city (e.g., Q64)"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="City Name"
                fullWidth
                required
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                disabled={isSubmitting}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Country"
                fullWidth
                required
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                disabled={isSubmitting}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="Population"
                fullWidth
                required
                type="number"
                value={population}
                onChange={(e) => setPopulation(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={isSubmitting}
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="Latitude"
                fullWidth
                required
                type="number"
                value={lat}
                onChange={(e) => setLat(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={isSubmitting}
                InputProps={{ inputProps: { min: -90, max: 90, step: 'any' } }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="Longitude"
                fullWidth
                required
                type="number"
                value={lon}
                onChange={(e) => setLon(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={isSubmitting}
                InputProps={{ inputProps: { min: -180, max: 180, step: 'any' } }}
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>Authentication Channels</Divider>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Add contact information for city officials who can verify the city's identity
              </Typography>
            </Grid>

            {authChannels.map((channel, index) => (
              <Grid item xs={12} key={index} container spacing={2}>
                <Grid item xs={12} sm={5}>
                  <TextField
                    label="Account"
                    fullWidth
                    required
                    value={channel.account}
                    onChange={(e) => handleChannelChange(index, 'account', e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Email address or LinkedIn profile"
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
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Confidence"
                    fullWidth
                    required
                    type="number"
                    value={channel.confidence}
                    onChange={(e) => handleChannelChange(index, 'confidence', e.target.value)}
                    disabled={isSubmitting}
                    InputProps={{ inputProps: { min: 0, max: 1, step: 0.1 } }}
                  />
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
