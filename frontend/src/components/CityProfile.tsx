import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Avatar, Divider, CircularProgress, Button, Link, Chip, IconButton } from '@mui/material';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import PublicIcon from '@mui/icons-material/Public';
import PeopleIcon from '@mui/icons-material/People';
import InfoIcon from '@mui/icons-material/Info';
import VerifiedIcon from '@mui/icons-material/Verified';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { PUBLIC_API_HOST, AUTOCOMPLETE_API_HOST } from '../constants';
import { City } from '../backendTypes';

interface ExtendedCity extends City {
  registered?: boolean;
  populationDate?: string;
  officialWebsite?: string;
  wikidataId?: string;
  socialMedia?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    youtube?: string;
    linkedin?: string;
  };
  supersedes_duplicates?: string[];
  superseded_by?: string;
}

const CityProfile: React.FC = () => {
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
        
        // Create a basic city object with the data from URL
        setCity({
          id: cityId,
          name: cityName,
          country: country,
          population: 0,
          lat: 0,
          lon: 0,
          authenticationKeyDistributionChannels: [],
          registered: registeredFromUrl,
          wikidataId: cityId.startsWith('Q') ? cityId : undefined
        });

        // First try to fetch detailed city data from the autocomplete API
        try {
          // For Wikidata QIDs, use direct QID lookup
          if (cityId.startsWith('Q') && /^Q\d+$/.test(cityId)) {
            console.log('Fetching detailed city data for QID:', cityId);
            const autocompleteResponse = await fetch(AUTOCOMPLETE_API_HOST, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                action: 'getByQid', 
                qid: cityId 
              })
            });

            if (autocompleteResponse.ok) {
              const autocompleteData = await autocompleteResponse.json();
              // Received detailed city data
              
              if (autocompleteData.results && autocompleteData.results.length > 0) {
                const cityDetails = autocompleteData.results[0];
                
                // Check if this city is superseded by another city
                if (cityDetails.superseded_by && cityDetails.superseded_by !== cityId) {
                }
                // Check if the returned wikidataId is different from the requested cityId
                else if (cityDetails.wikidataId && cityDetails.wikidataId !== cityId && cityDetails.supersedes_duplicates?.includes(cityId)) {
                  
                  // We already have the primary city details, so we can redirect directly
                  const redirectUrl = `/city/${cityDetails.wikidataId}?name=${encodeURIComponent(cityDetails.name)}&country=${encodeURIComponent(cityDetails.countryName || '')}`;
                  navigate(redirectUrl);
                  return;
                }
                
                // Update city with detailed information
                setCity(prevCity => ({
                  ...prevCity!,
                  name: cityDetails.name || prevCity!.name,
                  country: cityDetails.countryName || prevCity!.country,
                  population: cityDetails.population || prevCity!.population,
                  populationDate: cityDetails.populationDate,
                  lat: cityDetails.latitude || prevCity!.lat,
                  lon: cityDetails.longitude || prevCity!.lon,
                  officialWebsite: cityDetails.officialWebsite,
                  socialMedia: cityDetails.socialMedia,
                  supersedes_duplicates: cityDetails.supersedes_duplicates,
                  superseded_by: cityDetails.superseded_by
                }));
                
                // Skip the regular API call if we got detailed data
                return;
              }
            }
          } 
          // For non-Wikidata IDs, search by city name
          else {
            const autocompleteResponse = await fetch(AUTOCOMPLETE_API_HOST, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                action: 'autocomplete', 
                query: cityName,
                limit: 10
              })
            });

            if (autocompleteResponse.ok) {
              const autocompleteData = await autocompleteResponse.json();
              
              if (autocompleteData.results && autocompleteData.results.length > 0) {
                // Find the city with the maximum population
                let cityDetails = autocompleteData.results[0];
                let maxPopulation = cityDetails.population || 0;
                
                for (const city of autocompleteData.results) {
                  if (city.population && city.population > maxPopulation) {
                    cityDetails = city;
                    maxPopulation = city.population;
                  }
                }
                
                
                // Check if this city is superseded by another city
                if (cityDetails.superseded_by) {
                  
                  // Fetch details of the superseding city
                  try {
                    const supersedingResponse = await fetch(AUTOCOMPLETE_API_HOST, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'getByQid',
                        qid: cityDetails.superseded_by
                      })
                    });
                    
                    if (supersedingResponse.ok) {
                      const supersedingData = await supersedingResponse.json();
                      
                      if (supersedingData.results && supersedingData.results.length > 0) {
                        const supersedingCity = supersedingData.results[0];
                        
                        // Redirect to the superseding city with its correct name and country
                        const redirectUrl = `/city/${cityDetails.superseded_by}?name=${encodeURIComponent(supersedingCity.name)}&country=${encodeURIComponent(supersedingCity.countryName || '')}`;
                        navigate(redirectUrl);
                        return;
                      } else {
                        console.log('No results found for superseding city');
                      }
                    } else {
                      console.log('Failed to fetch superseding city details, status:', supersedingResponse.status);
                    }
                  } catch (err) {
                    console.error('Error fetching superseding city details:', err);
                  }
                  
                  // Fallback if we couldn't get superseding city details
                  navigate(`/city/${cityDetails.superseded_by}`);
                  return;
                }
                
                // If this city has a Wikidata ID and it's different from the current URL, update the URL
                if (cityDetails.wikidataId && cityDetails.wikidataId !== cityId) {
                  navigate(`/city/${cityDetails.wikidataId}?name=${encodeURIComponent(cityDetails.name)}&country=${encodeURIComponent(cityDetails.countryName || '')}`);
                  return;
                }
                
                // Update city with detailed information from the first search result
                setCity(prevCity => ({
                  ...prevCity!,
                  name: cityDetails.name || prevCity!.name,
                  country: cityDetails.countryName || prevCity!.country,
                  population: cityDetails.population || prevCity!.population,
                  populationDate: cityDetails.populationDate,
                  lat: cityDetails.latitude || prevCity!.lat,
                  lon: cityDetails.longitude || prevCity!.lon,
                  officialWebsite: cityDetails.officialWebsite,
                  socialMedia: cityDetails.socialMedia,
                  // Store the Wikidata ID for reference
                  wikidataId: cityDetails.wikidataId,
                  supersedes_duplicates: cityDetails.supersedes_duplicates,
                  superseded_by: cityDetails.superseded_by
                }));
                
                // Skip the regular API call if we got detailed data
                return;
              }
            }
          }
        } catch (err) {
          console.warn('Failed to fetch detailed city data, falling back to basic data:', err);
          // Continue with the regular API call
        }

        // Fetch additional city data if available (fallback)
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
    <Box sx={{ maxWidth: 800, mx: 'auto', pt: { xs: 2, sm: 4 }, px: { xs: 0, sm: 2 } }}>
      {/* Twitter-like header with back button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, px: { xs: 2, sm: 0 } }}>
        <IconButton 
          onClick={() => navigate('/')} 
          sx={{ mr: 1 }}
          aria-label="Back"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6">City Profile</Typography>
      </Box>
      
      {/* Twitter-like profile section */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', mb: 4, border: '1px solid #e0e0e0' }}>
        {/* Cover photo area - blue gradient */}
        <Box sx={{ 
          height: { xs: 120, sm: 150 }, 
          background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
          position: 'relative',
          overflow: 'hidden' // Add overflow hidden to prevent content from spilling out
        }}>
          {/* City name in the banner - with same left margin as before */}
          <Box sx={{ 
            position: 'absolute',
            bottom: { xs: 0, sm: 9 },
            left: { xs: 110, sm: 150 } // Align with the position it had below the avatar
          }}>
            <Typography 
              variant="h4" 
              component="h1" 
              sx={{ 
                fontWeight: 'bold',
                fontSize: { xs: '1.5rem', sm: '2rem', md: '2.125rem' },
                color: 'white',
                textShadow: '1px 1px 3px rgba(0,0,0,0.3)'
              }}
            >
              {city.name}
            </Typography>
          </Box>
          
          {/* Registration status chip - positioned in top right of banner */}
          <Box sx={{ 
            position: 'absolute',
            top: { xs: 10, sm: 15 },
            right: { xs: 10, sm: 15 }
          }}>
            {city.registered ? (
              <Chip 
                icon={<VerifiedIcon />} 
                label="Verified City" 
                color="primary" 
                variant="outlined"
                sx={{ bgcolor: 'rgba(255,255,255,0.8)' }}
              />
            ) : (
              <Chip 
                icon={<InfoIcon />} 
                label="Unregistered City" 
                color="default" 
                variant="outlined"
                sx={{ bgcolor: 'rgba(255,255,255,0.8)' }}
              />
            )}
          </Box>
        </Box>
        
        {/* Profile info section */}
        <Box sx={{ p: { xs: 2, sm: 3 }, pt: 0, position: 'relative' }}>
          <Box sx={{ display: 'flex', position: 'relative' }}>
            {/* Profile avatar - positioned to overlap the cover photo */}
            <Avatar 
              sx={{ 
                width: { xs: 90, sm: 120 }, 
                height: { xs: 90, sm: 120 }, 
                bgcolor: 'primary.main',
                border: '4px solid white',
                position: 'relative',
                top: { xs: -45, sm: -60 },
                mr: { xs: 2, sm: 3 }
              }}
            >
              <LocationCityIcon sx={{ fontSize: { xs: 45, sm: 60 } }} />
            </Avatar>
          </Box>
          
          {/* City basic info - with proper spacing from avatar */}
          <Box sx={{ 
            mt: { xs: -12, sm: -16 }, 
            ml: { xs: 12, sm: 17 }, 
            mb: { xs: 4, sm: 6 },
            pr: { xs: 1, sm: 0 }
          }}>
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
                <Typography variant="body2" component="span">
                  {city.population.toLocaleString()} residents
                  {city.populationDate && ` (as of ${city.populationDate})`}
                  {city.wikidataId && (
                    <>
                      {' '}
                      <Link
                        href={`https://www.wikidata.org/wiki/${city.wikidataId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ fontSize: '0.8rem', position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
                        component="a"
                        onClick={(e) => { e.stopPropagation(); }}
                      >
                        [source: Wikidata]
                      </Link>
                    </>
                  )}
                </Typography>
              </Box>
            )}
            
            {city.officialWebsite && (
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <PublicIcon sx={{ mr: 1, fontSize: 18 }} />
                <Link 
                  href={city.officialWebsite} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  variant="body2"
                  component="a"
                  onClick={(e) => { e.stopPropagation(); }}
                  sx={{ position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
                >
                  {city.officialWebsite}
                </Link>
              </Box>
            )}
            
            {/* Social Media Links */}
            {city.socialMedia && Object.keys(city.socialMedia).length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Social Media:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {city.socialMedia.twitter && (
                    <Chip 
                      label="Twitter" 
                      size="small"
                      component="a"
                      href={`https://twitter.com/${city.socialMedia.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                    />
                  )}
                  {city.socialMedia.facebook && (
                    <Chip 
                      label="Facebook" 
                      size="small"
                      component="a"
                      href={`https://facebook.com/${city.socialMedia.facebook}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                    />
                  )}
                  {city.socialMedia.instagram && (
                    <Chip 
                      label="Instagram" 
                      size="small"
                      component="a"
                      href={`https://instagram.com/${city.socialMedia.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                    />
                  )}
                  {city.socialMedia.youtube && (
                    <Chip 
                      label="YouTube" 
                      size="small"
                      component="a"
                      href={`https://youtube.com/channel/${city.socialMedia.youtube}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                    />
                  )}
                  {city.socialMedia.linkedin && (
                    <Chip 
                      label="LinkedIn" 
                      size="small"
                      component="a"
                      href={`https://linkedin.com/company/${city.socialMedia.linkedin}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                    />
                  )}
                </Box>
              </Box>
            )}

            {/* Removed duplication information section */}
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
              p: { xs: 1.5, sm: 2 }, 
              bgcolor: 'info.light', 
              borderRadius: 2,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: 1
            }}>
              <InfoIcon sx={{ color: '#e3f2fd', mt: { xs: 0.5, sm: 0 } }} />
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
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Coordinates: {city.lat.toFixed(2)}°N, {city.lon.toFixed(2)}°E
                </Typography>
              </Box>
              <Box sx={{ 
                mt: 1, 
                p: 1, 
                border: '1px solid #e0e0e0', 
                borderRadius: 1,
                bgcolor: '#f5f5f5',
                textAlign: 'center'
              }}>
                <Link 
                  href={`https://www.openstreetmap.org/?mlat=${city.lat}&mlon=${city.lon}&zoom=12`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                >
                  View on OpenStreetMap
                </Link>
                {' | '}
                <Link 
                  href={`https://www.google.com/maps?q=${city.lat},${city.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                >
                  View on Google Maps
                </Link>
              </Box>
            </Box>
          ) : null}
          
          {/* Wikidata reference */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', flexDirection: 'column', alignItems: 'flex-end' }}>
            {cityId && (cityId.startsWith('Q') || city.wikidataId) && (
              <Link
                href={`https://www.wikidata.org/wiki/${city.wikidataId || cityId}`}
                target="_blank"
                rel="noopener noreferrer"
                color="text.secondary"
                sx={{ fontSize: '0.8rem', textDecoration: 'none' }}
              >
                Wikidata: {city.wikidataId || cityId}
              </Link>
            )}
            
            {/* Similar entities section */}
            {((city.supersedes_duplicates && city.supersedes_duplicates.filter(id => id !== cityId && id !== city.wikidataId).length > 0) || city.superseded_by) && (
              <Typography color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
                Similar entities:{' '}
                {city.superseded_by && (
                  <Link
                    href={`https://www.wikidata.org/wiki/${city.superseded_by}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    color="text.secondary"
                    sx={{ fontSize: '0.75rem' }}
                  >
                    {city.superseded_by}
                  </Link>
                )}
                
                {city.superseded_by && city.supersedes_duplicates && city.supersedes_duplicates.filter(id => id !== cityId && id !== city.wikidataId).length > 0 && ', '}
                
                {city.supersedes_duplicates && city.supersedes_duplicates
                  .filter(id => id !== cityId && id !== city.wikidataId)
                  .map((duplicateId, index, array) => (
                    <React.Fragment key={duplicateId}>
                      <Link
                        href={`https://www.wikidata.org/wiki/${duplicateId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        color="text.secondary"
                        sx={{ fontSize: '0.75rem' }}
                      >
                        {duplicateId}
                      </Link>
                      {index < array.length - 1 && ', '}
                    </React.Fragment>
                  ))
                }
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default CityProfile;
