import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper, Avatar, Divider, CircularProgress, Button } from '@mui/material';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import PublicIcon from '@mui/icons-material/Public';
import PeopleIcon from '@mui/icons-material/People';
import { PUBLIC_API_HOST } from '../constants';
import { City } from '../backendTypes';
import CityInfoBox from './CityInfoBox';

interface CityProfileProps {
  cities?: Record<string, City>;
}

const CityProfile: React.FC<CityProfileProps> = ({ cities: initialCities }) => {
  const { cityId } = useParams<{ cityId: string }>();
  const [city, setCity] = useState<City | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cities, setCities] = useState<Record<string, City>>(initialCities || {});

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
        // If we already have the city data from props, use it
        if (initialCities && initialCities[cityId]) {
          setCity(initialCities[cityId]);
          setCities(initialCities);
          setLoading(false);
          return;
        }

        // Otherwise fetch the cities data
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
        setCities(data.cities || {});

        if (data.cities && data.cities[cityId]) {
          setCity(data.cities[cityId]);
        } else {
          // If we don't have data for this specific city, create a placeholder
          // This is useful for testing when the city might not be in the database yet
          
          // Extract city name and country from URL query parameters
          const urlParams = new URLSearchParams(window.location.search);
          const cityNameFromUrl = urlParams.get('name');
          const countryFromUrl = urlParams.get('country');
          
          // Use the city name from URL or fallback to ID
          const cityName = cityNameFromUrl || (cityId.includes('Q') ? cityId.replace('Q', '') : cityId);
          
          // Use the country from URL or fallback to Unknown
          const country = countryFromUrl || 'Unknown';
          
          setCity({
            id: cityId,
            name: cityName,
            country: country,
            population: 0,
            lat: 0,
            lon: 0,
            authenticationKeyDistributionChannels: []
          });
          console.warn(`City with ID ${cityId} not found in database, using placeholder`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching city data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCityData();
  }, [cityId, initialCities]);

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
          onClick={() => window.history.back()}
          sx={{ mt: 2 }}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4, px: 2 }}>
      {/* Use the existing CityInfoBox component for the main city information */}
      <CityInfoBox 
        cityId={cityId || null} 
        cityInfo={city} 
        cities={cities} 
        theme={null} 
      />
      
      {/* Additional Twitter-like profile section */}
      <Paper elevation={3} sx={{ p: 4, maxWidth: 800, mx: 'auto', mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar 
            sx={{ 
              width: 80, 
              height: 80, 
              bgcolor: 'primary.main',
              mr: 3
            }}
          >
            <LocationCityIcon sx={{ fontSize: 40 }} />
          </Avatar>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {city.name}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PublicIcon sx={{ mr: 0.5, fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  {city.country}
                </Typography>
              </Box>
              {city.population > 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon sx={{ mr: 0.5, fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="body2" color="text.secondary">
                    {city.population.toLocaleString()} residents
                  </Typography>
                </Box>
              ) : null}
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="body1" paragraph>
          {city.name} {city.country !== 'Unknown' ? `is a city in ${city.country}.` : ''}
          {city.population > 0 ? ` It has a population of approximately ${city.population.toLocaleString()} residents.` : ''}
        </Typography>

        <Typography variant="body1" paragraph>
          {city.country !== 'Unknown' ? (
            "This city is registered on the City Vote platform, allowing its administration to participate in polls and voting."
          ) : (
            "This city profile is based on limited information. The city may not be fully registered in the system yet."
          )}
        </Typography>
        
        {city.country === 'Unknown' ? (
          <Box sx={{ 
            mt: 2, 
            p: 2, 
            bgcolor: 'info.light', 
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }}>
            <span className="material-icons" style={{ color: '#1976d2' }}>info</span>
            <Typography variant="body2" color="info.dark">
              Want to register this city? Visit the <a href="/register" style={{ color: '#1976d2' }}>Registration</a> page to add it to the City Vote platform.
            </Typography>
          </Box>
        ) : null}

        {(city.lat && city.lon && city.lat !== 0 && city.lon !== 0) ? (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Location
            </Typography>
            </Box>
        ) : null}
      </Paper>
    </Box>
  );
};

export default CityProfile;
