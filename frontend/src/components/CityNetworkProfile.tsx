import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Avatar, Divider, CircularProgress, Button, Link, Chip, IconButton, Grid, Tooltip } from '@mui/material';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import PublicIcon from '@mui/icons-material/Public';
import PeopleIcon from '@mui/icons-material/People';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LinkIcon from '@mui/icons-material/Link';
import { PUBLIC_DATA_BUCKET_URL } from '../constants';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import countryBorders from './countryBorders.json';

interface EurocitiesMember {
  name_on_website: string;
  wikidata_id: string;
  wikidata_name: string;
  latitude: number;
  longitude: number;
  population: number | null;
  country: string;
  country_name: string;
}

interface CityMapPoint {
  coordinates: [number, number];
  name: string;
  wikidataId: string;
  size: number;
  country?: string;
  population?: number | null;
}

interface EurocitiesData {
  members: EurocitiesMember[];
  not_found: string[];
}

const CityNetworkProfile: React.FC = () => {
  const navigate = useNavigate();
  const { networkId } = useParams<{ networkId: string }>();
  const [networkData, setNetworkData] = useState<EurocitiesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPopulation, setTotalPopulation] = useState<number | null>(null);

  useEffect(() => {
    const fetchNetworkData = async () => {
      if (!networkId) {
        setError('No network ID provided');
        setLoading(false);
        return;
      }

      // Only load data if the network is eurocities
      if (networkId.toLowerCase() !== 'eurocities') {
        setError('Network not found');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch the Eurocities members data from the S3 bucket
        const response = await fetch(`${PUBLIC_DATA_BUCKET_URL}/city-networks/eurocities/members-wikidata-enriched.json`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch network data');
        }

        const data: EurocitiesData = await response.json();
        setNetworkData(data);
        
        // Calculate total population
        const total = data.members
          .filter(member => member.population !== null)
          .reduce((sum, member) => sum + (member.population || 0), 0);
        setTotalPopulation(total);
      } catch (err) {
        console.error('Error fetching network data:', err);
        setError('Failed to load network data');
      } finally {
        setLoading(false);
      }
    };

    fetchNetworkData();
  }, [networkId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !networkData) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="h5" color="error" gutterBottom>
          {error || 'Network not found'}
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

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', pt: { xs: 2, sm: 4 }, px: { xs: 0, sm: 2 } }}>
      {/* Header with back button */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, px: { xs: 2, sm: 0 } }}>
        <IconButton 
          onClick={() => navigate('/')} 
          sx={{ mr: 1 }}
          aria-label="Back"
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6">Eurocities Network</Typography>
      </Box>
      
      {/* Network info section */}
      <Paper elevation={0} sx={{ borderRadius: 3, overflow: 'hidden', mb: 4, border: '1px solid #e0e0e0' }}>
        {/* Cover photo area with map */}
        <Box sx={{ 
          height: { xs: 300, sm: 350 }, 
          background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Network Map */}
          {networkData && <NetworkMap members={networkData.members} />}
          <Box sx={{ 
            position: 'absolute',
            bottom: { xs: 0, sm: 9 },
            left: { xs: 110, sm: 150 }
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
              Eurocities
            </Typography>
          </Box>
        </Box>
        
        {/* Network info section */}
        <Box sx={{ p: { xs: 2, sm: 3 }, pt: 0, position: 'relative' }}>
          <Box sx={{ display: 'flex', position: 'relative' }}>
            {/* Network avatar */}
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
          
          {/* Network basic info */}
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
                  European City Network
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <PeopleIcon sx={{ mr: 1, fontSize: 18 }} />
                <Typography variant="body2">
                  {networkData.members.length} member cities
                </Typography>
              </Box>
              
              {totalPopulation && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <PeopleIcon sx={{ mr: 1, fontSize: 18 }} />
                  <Typography variant="body2">
                    Total population: approximately {totalPopulation.toLocaleString()} residents
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ display: 'flex', alignItems: 'center', position: 'relative', zIndex: 1000 }}>
                <LinkIcon sx={{ mr: 1, fontSize: 18, color: 'primary.main' }} />
                <Link 
                  href="https://eurocities.eu/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ 
                    color: 'primary.main',
                    fontWeight: 'medium',
                    textDecoration: 'none',
                    '&:hover': { 
                      textDecoration: 'underline',
                      color: 'primary.dark'
                    },
                    cursor: 'pointer'
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    eurocities.eu
                  </Typography>
                </Link>
              </Box>
            </Box>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {/* Network description */}
          <Typography variant="body1" paragraph>
            Eurocities is a network of major European cities, founded in 1986. The network engages in dialogue with European institutions on various aspects of EU legislation and policies that affect cities and their citizens.
          </Typography>
          
          {/* Member cities section */}
          <Typography variant="h6" sx={{ mt: 3, mb: 2 }}>
            Member Cities
          </Typography>
          
          <Grid container spacing={2}>
            {networkData.members
              .sort((a, b) => a.wikidata_name.localeCompare(b.wikidata_name))
              .map((member, index) => (
                <Grid item xs={12} sm={6} md={4} key={`${member.wikidata_id}-${index}`}>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      border: '1px solid #e0e0e0', 
                      borderRadius: 2,
                      height: '100%',
                      transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
                      }
                    }}
                  >
                    <Link 
                      href={`/city/${member.wikidata_id}`} 
                      sx={{ 
                        textDecoration: 'none', 
                        color: 'inherit',
                        display: 'block'
                      }}
                    >
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                        {member.wikidata_name}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <PublicIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {member.country_name}
                        </Typography>
                      </Box>
                      
                      {member.population && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <PeopleIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {member.population.toLocaleString()} residents
                          </Typography>
                        </Box>
                      )}
                    </Link>
                  </Paper>
                </Grid>
              ))}
          </Grid>
          
          {/* Not found cities section */}
          {networkData.not_found && networkData.not_found.length > 0 && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Other members
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {networkData.not_found.map((cityName) => (
                  <Chip 
                    key={cityName}
                    label={cityName}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          )}
          
          {/* External link */}
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Button
              variant="outlined"
              component="a"
              href="https://eurocities.eu/"
              target="_blank"
              rel="noopener noreferrer"
              startIcon={<PublicIcon />}
            >
              Visit Eurocities Website
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

// NetworkMap component for displaying city network members on a map
const NetworkMap: React.FC<{ members: EurocitiesMember[] }> = ({ members }) => {
  const navigate = useNavigate();
  
  // Convert members to map points with population-based sizing like in WorldMap
  const mapPoints: CityMapPoint[] = members
    .map(member => ({
      coordinates: [member.longitude, member.latitude] as [number, number],
      name: member.wikidata_name,
      wikidataId: member.wikidata_id,
      // Similar sizing logic to WorldMap
      size: member.population ? Math.max(3, member.population / 500000) : 3,
      country: member.country_name,
      population: member.population
    }))
    // Sort by population (ascending) so larger cities are rendered last and appear on top
    .sort((a, b) => (a.population || 0) - (b.population || 0));

  const handleCityClick = (city: CityMapPoint) => {
    navigate(`/city/${city.wikidataId}`);
  };

  return (
    <Box sx={{ 
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <ComposableMap
        projectionConfig={{ 
          scale: 750, // More zoomed in
          center: [15, 50] // Centered on Europe
        }}
        width={800}
        height={400}
        style={{
          width: '100%',
          height: '100%'
        }}
      >
        <Geographies geography={countryBorders}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#F5F4F6"
                stroke="#D6D6DA"
                style={{
                  default: { outline: 'none', fill: '#E4E5E9' },
                  hover: { outline: 'none', fill: '#D6D6DA' },
                  pressed: { outline: 'none' }
                }}
              />
            ))
          }
        </Geographies>
        
        {/* City markers - small dots with tooltips */}
        {mapPoints.map((city, i) => (
          <Marker key={i} coordinates={city.coordinates}>
            <Tooltip 
              title={city.name}
              arrow 
              placement="top"
            >
              <g
                onClick={() => handleCityClick(city)}
                style={{ 
                  cursor: 'pointer',
                  // Apply z-index based on population to ensure larger cities' tooltips appear on top
                  zIndex: city.population ? Math.floor(city.population / 10000) : 1
                }}
              >
                {/* Larger invisible hit area */}
                <circle
                  r={8}
                  fill="transparent"
                />
                {/* Visible city dot - styled like WorldMap */}
                <circle
                  r={city.size / 2}
                  fill="#1a237e"
                  opacity={0.75}
                  stroke="none"
                  style={{ 
                    pointerEvents: 'none',
                    transition: 'fill 0.2s, opacity 0.2s, r 0.3s',
                  }}
                />
              </g>
            </Tooltip>
          </Marker>
        ))}
      </ComposableMap>
    </Box>
  );
};

export default CityNetworkProfile;
