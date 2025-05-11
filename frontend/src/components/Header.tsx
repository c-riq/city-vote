import { useNavigate } from 'react-router-dom';
import { Typography, Box, Button, IconButton } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import LocationCityIcon from '@mui/icons-material/LocationCity';

interface HeaderProps {
  cityInfo: {
    name: string;
    id: string;
  } | null;
  onLogout: () => void;
  onCreatePoll: () => void;
}

function Header({ cityInfo, onLogout, onCreatePoll }: HeaderProps) {
  const navigate = useNavigate();
  
  return (
    <Box
      component="header"
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '64px',
        backgroundColor: cityInfo ? 'rgba(25, 118, 210, 0.15)' : 'background.paper',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: 1,
        borderColor: 'divider',
        zIndex: 1100,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <img 
          src="/img/logo.png" 
          alt="City Vote Logo" 
          style={{ 
            height: '40px',
            width: 'auto',
            cursor: 'pointer'
          }} 
          onClick={() => navigate('/')}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography 
            variant="h6" 
            component="div"
            sx={{ 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: { xs: '1rem', sm: '1.25rem' },
              '&:hover': { color: 'primary.main' }
            }}
            onClick={() => navigate('/')}
          >
            city-vote.com
          </Typography>
          <Typography 
            variant="body2" 
            component="a"
            href="/about-city-vote.html"
            sx={{ 
              color: 'text.secondary',
              textDecoration: 'none',
              marginRight: '12px',
              marginLeft: '12px',
              '&:hover': { 
                color: 'primary.main',
                textDecoration: 'underline'
              }
            }}
          >
            About
          </Typography>
          <Typography 
            variant="body2" 
            component="div"
            onClick={() => navigate('/polls')}
            sx={{ 
              color: 'text.secondary',
              textDecoration: 'none',
              cursor: 'pointer',
              marginRight: '12px',
              '&:hover': { 
                color: 'primary.main',
                textDecoration: 'underline'
              }
            }}
          >
            Polls
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {cityInfo ? (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', textAlign: 'right', mr: 2 }}>
              <LocationCityIcon sx={{ mr: 1, color: 'primary.main', opacity: 0.4 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                {cityInfo.name}
              </Typography>
            </Box>
            
            <Button
              variant="contained"
              color="primary"
              onClick={onCreatePoll}
              sx={{ mr: 2 }}
            >
              Create Poll
            </Button>

            <IconButton 
              onClick={onLogout}
              color="inherit"
              title="Logout"
            >
              <LogoutIcon />
            </IconButton>
          </>
        ) : (
          <IconButton 
            onClick={() => navigate('/')}
            color="inherit"
            title="Login"
          >
            <LoginIcon />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

export default Header;
