import { Box, Typography, Link as MuiLink, Button } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { City } from '../voteBackendTypes';

interface CityInfoBoxProps {
  cityId: string | null;
  cityInfo: City | null;
  cities: Record<string, City>;
  theme: any;
  token?: string;
}

function CityInfoBox({ cityId, cityInfo, cities, token }: CityInfoBoxProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const city = cityId ? cities[cityId] : cityInfo;
  const showBackButton = location.pathname.startsWith('/city/');
  
  // Extract expiration timestamp from token if it's the current city
  const getExpirationInfo = () => {
    if (!token || !cityId) {
      return null;
    }
    
    const match = token.match(/_(\d{10})$/);
    if (!match) {
      return null;
    }
    
    const timestamp = parseInt(match[1]) * 1000;
    return new Date(timestamp).toLocaleString();
  };

  const expirationTime = getExpirationInfo();

  return (
    <Box sx={{ 
      width: '100%', 
      maxWidth: 800,
      textAlign: 'left',
      mb: 4,
    }}>
      {showBackButton && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          mb: 4,
          alignItems: 'center'
        }}>
          <Button 
            onClick={() => navigate('/')} 
            variant="outlined"
            startIcon={<span className="material-icons">arrow_back</span>}
            sx={{
              borderRadius: 2,
              px: 3
            }}
          >
            Back to Dashboard
          </Button>
        </Box>
      )}

      <Box sx={{
        p: 4,
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}>
        <Typography variant="h5" sx={{ 
          color: 'primary.main',
          fontWeight: 600,
          mb: 1,
        }}>
          {city?.name}
        </Typography>
        
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Country
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {city?.country}
            </Typography>
          </Box>
          
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Population
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {city?.population?.toLocaleString() || 'N/A'} ± 10%
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Authentication key distribution channel
            </Typography>
            {city?.authenticationKeyDistributionChannels.map((channel, index) => (
              <Typography key={index} variant="body2" sx={{ 
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5
              }}>
                {channel.type === 'linkedin' ? (
                  <MuiLink 
                    href={`${channel.account}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ 
                      color: 'primary.main',
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline'
                      }
                    }}
                  >
                    Mayor's presumed Linkedin account
                  </MuiLink>
                ) : 
                (
                  null //`${channel.type}: ${channel.account}`
                )
                }
              </Typography>
            ))}
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Verified by
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Rix Data NL B.V.
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Verification and authentication confidence level
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {Math.max(...(city?.authenticationKeyDistributionChannels.map(c => c.confidence * 100) || [0]))}%
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Coordinates
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {city?.lat && city?.lon ? (
                <MuiLink 
                  href={`https://www.google.com/maps?q=${city.lat},${city.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ 
                    color: 'primary.main',
                    textDecoration: 'none',
                    '&:hover': {
                      textDecoration: 'underline'
                    }
                  }}
                >
                  {city.lat.toFixed(4)}°N, {city.lon.toFixed(4)}°E
                </MuiLink>
              ) : (
                'N/A'
              )}
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Wikidata identifier
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              <MuiLink 
                href={`https://www.wikidata.org/wiki/${cityId}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ 
                  color: 'primary.main',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
              >
                {cityId}
              </MuiLink>
            </Typography>
          </Box>

          {expirationTime && (
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Access Token Expiration
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {expirationTime}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default CityInfoBox; 