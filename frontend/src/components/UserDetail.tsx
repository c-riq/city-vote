import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { PERSONAL_AUTH_API_HOST, AUTOCOMPLETE_API_HOST } from '../constants';
import { AuthUserProfile } from '../backendTypes';

interface UserDetailProps {}

interface UserWithDetails extends AuthUserProfile {
  email: string;
}

interface CityResult {
  wikidataId: string;
  name: string;
  countryName: string;
  countryCode: string;
  stateProvinceLabel?: string;
}

const UserDetail: React.FC<UserDetailProps> = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [citySearchResults, setCitySearchResults] = useState<CityResult[]>([]);
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const [verificationData, setVerificationData] = useState({
    cityId: '',
    cityName: '',
    title: '',
    confidence: 0.8,
    isAuthorisedRepresentative: false,
  });

  // Check if user is admin
  const isAdmin = () => {
    const adminStatus = localStorage.getItem('userIsAdmin');
    return adminStatus === 'true';
  };

  useEffect(() => {
    if (!isAdmin()) {
      setError('Access denied. Administrator privileges required.');
      setIsLoading(false);
      return;
    }
    
    fetchUserDetails();
  }, [userId]);

  const fetchUserDetails = async () => {
    try {
      setIsLoading(true);
      const sessionToken = localStorage.getItem('userSessionToken');
      const userEmail = localStorage.getItem('userEmail');
      
      if (!sessionToken || !userEmail) {
        setError('Authentication required. Please log in.');
        return;
      }

      // First get all users to find the one with matching userId
      const response = await fetch(`${PERSONAL_AUTH_API_HOST}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          action: 'getAllUsers',
          email: userEmail,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch user details');
      }

      const foundUser = data.users?.find((u: UserWithDetails) => u.userId === userId);
      if (!foundUser) {
        setError('User not found');
        return;
      }

      setUser(foundUser);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user details');
    } finally {
      setIsLoading(false);
    }
  };

  const searchCities = async (query: string) => {
    if (query.length < 2) {
      setCitySearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      const response = await fetch(`${AUTOCOMPLETE_API_HOST}`, {
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
      if (response.ok && data.results) {
        setCitySearchResults(data.results);
      }
    } catch (err) {
      console.error('City search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCitySelect = (city: CityResult) => {
    setVerificationData({
      ...verificationData,
      cityId: city.wikidataId,
      cityName: `${city.name}, ${city.countryCode}${city.stateProvinceLabel ? `, ${city.stateProvinceLabel}` : ''}`
    });
    setCitySearchQuery(verificationData.cityName);
    setCitySearchResults([]);
  };

  const submitVerification = async () => {
    if (!user) return;

    try {
      const sessionToken = localStorage.getItem('userSessionToken');
      const adminUserId = localStorage.getItem('userId');
      const adminEmail = localStorage.getItem('userEmail');
      
      if (!sessionToken || !adminUserId || !adminEmail) {
        setError('Authentication required');
        return;
      }

      // This would need to be implemented in the backend
      const response = await fetch(`${PERSONAL_AUTH_API_HOST}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          action: 'addCityVerification',
          email: adminEmail,
          targetUserEmail: user.email,
          verification: {
            cityId: verificationData.cityId,
            title: verificationData.title,
            isAuthorisedRepresentative: verificationData.isAuthorisedRepresentative,
            confidence: verificationData.confidence,
            identityVerifiedBy: adminUserId, // This will be overridden by representingCityNetwork in backend
            time: new Date().toISOString(),
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Verification failed');
      }

      // Refresh user details
      await fetchUserDetails();
      setVerificationDialogOpen(false);
      resetVerificationForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const resetVerificationForm = () => {
    setVerificationData({
      cityId: '',
      cityName: '',
      title: '',
      confidence: 0.8,
      isAuthorisedRepresentative: false,
    });
    setCitySearchQuery('');
    setCitySearchResults([]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!isAdmin()) {
    return (
      <Box sx={{ py: 4, px: 2, mt: 10 }}>
        <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
          <Alert severity="error">
            Access denied. Administrator privileges required to view this page.
          </Alert>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4, px: 2, mt: 10 }}>
      <Paper elevation={3} sx={{ p: 4, mx: 'auto', maxWidth: 800 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Button
            onClick={() => navigate('/users')}
            sx={{ mr: 2 }}
          >
            ← Back to Users
          </Button>
          <Typography variant="h4" component="h1">
            User Details
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : user ? (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    User Information
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Email: {user.email}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    User ID: {user.userId}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Created: {formatDate(user.createdAt)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Last Login: {formatDate(user.lastLogin)}
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Chip
                      label={user.emailVerified ? 'Email Verified' : 'Email Pending'}
                      color={user.emailVerified ? 'success' : 'warning'}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    {user.isAdmin && (
                      <Chip
                        label="Administrator"
                        color="primary"
                        size="small"
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      City Associations
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setVerificationDialogOpen(true)}
                    >
                      Add Verification
                    </Button>
                  </Box>
                  
                  {user.cityAssociations && user.cityAssociations.length > 0 ? (
                    <List dense>
                      {user.cityAssociations.map((association, index) => (
                        <React.Fragment key={index}>
                          <ListItem>
                            <ListItemText
                              primary={association.title}
                              secondary={
                                <Box>
                                  <Typography variant="body2" color="text.secondary">
                                    City ID: {association.cityId}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Confidence: {(association.confidence * 100).toFixed(0)}%
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Verified: {formatDate(association.time)}
                                  </Typography>
                                  {association.isAuthorisedRepresentative && (
                                    <Chip
                                      label="Authorized Representative"
                                      size="small"
                                      color="primary"
                                      sx={{ mt: 1 }}
                                    />
                                  )}
                                </Box>
                              }
                            />
                          </ListItem>
                          {index < user.cityAssociations!.length - 1 && <Divider />}
                        </React.Fragment>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">
                      No city associations found
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        ) : (
          <Typography color="text.secondary">
            User not found
          </Typography>
        )}

        {/* Verification Dialog */}
        <Dialog
          open={verificationDialogOpen}
          onClose={() => setVerificationDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            Add City Verification
          </DialogTitle>
          <DialogContent>
            {user && (
              <Box sx={{ pt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Adding verification for: {user.email}
                </Typography>
                
                <TextField
                  label="Search Cities"
                  fullWidth
                  margin="normal"
                  value={citySearchQuery}
                  onChange={(e) => {
                    setCitySearchQuery(e.target.value);
                    searchCities(e.target.value);
                  }}
                  placeholder="Type city name..."
                />
                
                {isSearching && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                )}
                
                {citySearchResults.length > 0 && (
                  <Paper sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                    <List dense>
                      {citySearchResults.map((city) => (
                        <ListItem
                          key={city.wikidataId}
                          button
                          onClick={() => handleCitySelect(city)}
                        >
                          <ListItemText
                            primary={city.name}
                            secondary={`${city.countryName} (${city.wikidataId})`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Paper>
                )}
                
                <TextField
                  label="User's Title/Position"
                  fullWidth
                  margin="normal"
                  value={verificationData.title}
                  onChange={(e) => setVerificationData({
                    ...verificationData,
                    title: e.target.value
                  })}
                  placeholder="Mayor, City Councilor, etc."
                />
                
                <TextField
                  label="Confidence Level"
                  type="number"
                  fullWidth
                  margin="normal"
                  value={verificationData.confidence}
                  onChange={(e) => setVerificationData({
                    ...verificationData,
                    confidence: parseFloat(e.target.value)
                  })}
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                  helperText="0.0 to 1.0 (1.0 = fully verified)"
                />
                
                <FormControl fullWidth margin="normal">
                  <InputLabel>Authorised Representative</InputLabel>
                  <Select
                    value={verificationData.isAuthorisedRepresentative ? 'true' : 'false'}
                    onChange={(e) => setVerificationData({
                      ...verificationData,
                      isAuthorisedRepresentative: e.target.value === 'true'
                    })}
                  >
                    <MenuItem value="false">No</MenuItem>
                    <MenuItem value="true">Yes</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setVerificationDialogOpen(false);
              resetVerificationForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={submitVerification}
              variant="contained"
              disabled={!verificationData.cityId || !verificationData.title}
            >
              Add Verification
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
};

export default UserDetail;