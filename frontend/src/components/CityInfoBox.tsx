import { Box, Typography, Tooltip, Link as MuiLink, Button } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

interface CityInfo {
  id: string;
  name: string;
  population: number;
  country: string;
  lat: number;
  lon: number;
}

interface CityInfoBoxProps {
  cityId: string | null;
  cityInfo: CityInfo | null;
  cities: Record<string, CityInfo>;
  theme: any;
}

function CityInfoBox({ cityId, cityInfo, cities, theme }: CityInfoBoxProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const city = cityId ? cities[cityId] : cityInfo;
  const showBackButton = location.pathname.startsWith('/city/');
  
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
              Verification method
            </Typography>
            <Typography variant="body2" sx={{ 
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5
            }}>
              Mayor linkedin account
              <Tooltip title="Authentication via the official city website will soon be required">
                <span 
                  className="material-icons"
                  style={{ 
                    fontSize: '16px',
                    color: theme.palette.primary.main,
                    cursor: 'help'
                  }}
                >
                  info
                </span>
              </Tooltip>
            </Typography>
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
              Verification confidence level
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              90%
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Coordinates
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {city?.lat?.toFixed(4) || 'N/A'}°N, {city?.lon?.toFixed(4) || 'N/A'}°E
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
        </Box>
      </Box>
    </Box>
  );
}

export default CityInfoBox; 