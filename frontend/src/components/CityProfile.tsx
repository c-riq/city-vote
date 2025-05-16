import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Avatar, Divider, CircularProgress, Button, Link, Chip } from '@mui/material';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import PublicIcon from '@mui/icons-material/Public';
import PeopleIcon from '@mui/icons-material/People';
import InfoIcon from '@mui/icons-material/Info';
import VerifiedIcon from '@mui/icons-material/Verified';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { PUBLIC_API_HOST } from '../constants';
import { City } from '../backendTypes';

interface CityProfileProps {
  cities?: Record<string, City>;
}

interface ExtendedCity extends City {
  registered?: boolean;
}

const CityProfile: React.FC<CityProfileProps> = ({ cities: initialCities }) => {
  const navigate = useNavigate();
  const { cityId } = useParams<{ cityId: string }>();
  const [city, setCity] = useState<ExtendedCity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCityData = async () => {
      if (!cityId) {
        setError('No city ID provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Extract city name and country from URL query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const cityNameFromUrl = urlParams.get('name');
        const countryFromUrl = urlParams.get('country');
        const registeredFromUrl = urlParams.get('registered') === 'true';
        
        // Use the city name from URL or fallback to ID
        const cityName = cityNameFromUrl || (cityId.includes('Q') ? cityId.replace('Q', '') : cityId);
        
        // Use the country from URL or fallback to Unknown
        const country = countryFromUrl || 'Unknown';
        
        // Create a city object with the data from URL
        setCity({
          id: cityId,
          name: cityName,
          country: country,
          population: 0,
          lat: 0,
          lon: 0,
          authenticationKeyDistributionChannels: [],
          registered: registeredFromUrl
        });

        // Fetch additional city data if available
        console.log('Fetching city data for ID:', cityId);
        const response = await fetch(PUBLIC_API_HOST, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getCities' })
        });

        if (!response.ok) {
          throw new Error('Failed to fetch city data');
        }

        const data = await response.json();
        console.log('Received cities data:', data);

        if (data.cities && data.cities[cityId]) {
          // Update with additional data from the API
          setCity(prevCity => ({
            ...data.cities[cityId],
            name: prevCity?.name || data.cities[cityId].name,
            country: prevCity?.country || data.cities[cityId].country,
            registered: registeredFromUrl
          }));
        } else {
          console.warn(`City with ID ${cityId} not found in database, using placeholder`);
        }
      } catch (err) {
        console.error('Error fetching city data:', err);
        // We don't set error here because we already have basic city data from URL
      } finally {
        setLoading(false);
      }
    };

    fetchCityData();
  }, [cityId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !city) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h5" color="error" gutterBottom>
          {error || 'City not found'}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => navigate('/')}
          sx={{ mt: 2 }}
        >
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  // Format a random join date for the Twitter-like experience
  const joinDate = new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
  const joinDateFormatted = joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', pt: 4, px: 2 }}>
      {/* Twitter-like header with back button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Button 
          onClick={() => navigate('/')} 
          startIcon={<span className="material-icons">arrow_back</span>}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h6">City Profile</Typography>
      </Box>
      
      {/* Twitter-like profile section */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', mb: 4, border: '1px solid #e0e0e0' }}>
        {/* Cover photo area - blue gradient */}
        <Box sx={{ 
          height: 150, 
          background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
          position: 'relative'
        }} />
        
        {/* Profile info section */}
        <Box sx={{ p: 3, pt: 0, position: 'relative' }}>
          <Box sx={{ display: 'flex', position: 'relative' }}>
            {/* Profile avatar - positioned to overlap the cover photo */}
            <Avatar 
              sx={{ 
                width: 120, 
                height: 120, 
                bgcolor: 'primary.main',
                border: '4px solid white',
                position: 'relative',
                top: -60,
                mr: 3
              }}
            >
              <LocationCityIcon sx={{ fontSize: 60 }} />
            </Avatar>
            
            {/* Registration status chip */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              position: 'absolute',
              right: 0,
              top: -40
            }}>
              {city.registered ? (
                <Chip 
                  icon={<VerifiedIcon />} 
                  label="Verified City" 
                  color="primary" 
                  variant="outlined"
                />
              ) : (
                <Chip 
                  icon={<InfoIcon />} 
                  label="Unregistered City" 
                  color="default" 
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
          
          {/* City name and basic info - with proper spacing from avatar */}
          <Box sx={{ mt: -20, ml: 17, mb: 6 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
              {city.name}
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, color: 'text.secondary', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PublicIcon sx={{ mr: 1, fontSize: 18 }} />
                <Typography variant="body2">
                  {city.country}
                </Typography>
              </Box>
              
              {city.registered && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <CalendarMonthIcon sx={{ mr: 1, fontSize: 18 }} />
                  <Typography variant="body2">
                    Joined {joinDateFormatted}
                  </Typography>
                </Box>
              )}
            </Box>
            {city.population > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PeopleIcon sx={{ mr: 1, fontSize: 18 }} />
                <Typography variant="body2">
                  {city.population.toLocaleString()} residents
                </Typography>
              </Box>
            )}
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {/* City description */}
          <Typography variant="body1" paragraph>
            {city.name} {city.country !== 'Unknown' ? `is a city in ${city.country}.` : ''}
            {city.population > 0 ? ` It has a population of approximately ${city.population.toLocaleString()} residents.` : ''}
          </Typography>
          
          {/* Registration status message */}
          <Typography variant="body1" paragraph>
            {city.registered ? (
              "This city is registered on the City Vote platform, allowing its administration to participate in polls and voting."
            ) : (
              "This city profile is based on limited information. The city is not yet registered in the system."
            )}
          </Typography>
          
          {/* Registration call-to-action for unregistered cities */}
          {!city.registered && (
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              bgcolor: 'info.light', 
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}>
              <InfoIcon sx={{ color: '#e3f2fd' }} />
              <Typography variant="body2" color="info.dark">
                Want to register this city? Visit the <Link href="/register" color="primary" sx={{ fontWeight: 'bold', color: '#e3f2fd' }}>Registration</Link> page to add it to the City Vote platform.
              </Typography>
            </Box>
          )}
          
          {/* Map section */}
          {(city.lat && city.lon && city.lat !== 0 && city.lon !== 0) ? (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Location
              </Typography>
              <Box 
                component="iframe"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${city.lon-0.1}%2C${city.lat-0.1}%2C${city.lon+0.1}%2C${city.lat+0.1}&layer=mapnik&marker=${city.lat}%2C${city.lon}`}
                sx={{ 
                  width: '100%', 
                  height: '300px', 
                  border: '1px solid #eee',
                  borderRadius: 2
                }}
                title={`Map of ${city.name}`}
              />
            </Box>
          ) : null}
          
          {/* Wikidata reference */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Link 
              href={`https://www.wikidata.org/wiki/${cityId}`}
              target="_blank"
              rel="noopener noreferrer"
              color="text.secondary"
              sx={{ fontSize: '0.8rem', textDecoration: 'none' }}
            >
              Wikidata: {cityId}
            </Link>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default CityProfile;
