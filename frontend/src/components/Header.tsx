import { useNavigate } from 'react-router-dom';
import { 
  Typography, 
  Box, 
  Button, 
  IconButton, 
  TextField, 
  Autocomplete, 
  CircularProgress,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import SearchIcon from '@mui/icons-material/Search';
import MenuIcon from '@mui/icons-material/Menu';
import InfoIcon from '@mui/icons-material/Info';
import PollIcon from '@mui/icons-material/Poll';
import AppRegistrationIcon from '@mui/icons-material/AppRegistration';
import HomeIcon from '@mui/icons-material/Home';
import { useState, useEffect, useRef } from 'react';
import { AUTOCOMPLETE_API_HOST } from '../constants';

interface CityAutocompleteResult {
  wikidataId: string;
  name: string;
  countryWikidataId: string;
  countryName: string;
  countryCode: string;
  stateProvinceWikidataId?: string;
  stateProvinceLabel?: string;
  registered?: boolean;
}

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [searchValue, setSearchValue] = useState<CityAutocompleteResult | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<CityAutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const autocompleteTimeoutRef = useRef<number | null>(null);
  
  // Check if user is logged in and listen for login/logout events
  useEffect(() => {
    // Check localStorage for existing session
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail) {
      setUserEmail(storedEmail);
    }
    
    // Listen for login events
    const handleUserLogin = (event: Event) => {
      const customEvent = event as CustomEvent<{email: string, userId: string}>;
      setUserEmail(customEvent.detail.email);
    };
    
    // Listen for logout events
    const handleUserLogout = () => {
      setUserEmail(null);
    };
    
    window.addEventListener('userLogin', handleUserLogin);
    window.addEventListener('userLogout', handleUserLogout);
    
    return () => {
      window.removeEventListener('userLogin', handleUserLogin);
      window.removeEventListener('userLogout', handleUserLogout);
    };
  }, []);
  
  // Handle user logout
  const handleUserLogout = () => {
    localStorage.removeItem('userSessionToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    setUserEmail(null);
    
    // Dispatch logout event
    const logoutEvent = new CustomEvent('userLogout');
    window.dispatchEvent(logoutEvent);
    
    navigate('/login/user');
  };
  
  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (
      event.type === 'keydown' &&
      ((event as React.KeyboardEvent).key === 'Tab' ||
        (event as React.KeyboardEvent).key === 'Shift')
    ) {
      return;
    }
    setDrawerOpen(open);
  };
  
  const fetchAutocompleteResults = async (query: string) => {
    if (!query || query.length < 2) {
      setOptions([]);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(AUTOCOMPLETE_API_HOST, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'autocomplete',
          query,
          limit: 50
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Autocomplete error:', data.message || 'Failed to fetch autocomplete results');
        setOptions([]);
        return;
      }

      setOptions(data.results || []);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounce the autocomplete API calls
  useEffect(() => {
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current);
    }

    if (inputValue.length >= 2) {
      autocompleteTimeoutRef.current = setTimeout(() => {
        fetchAutocompleteResults(inputValue);
      }, 300);
    } else {
      setOptions([]);
    }

    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current);
      }
    };
  }, [inputValue]);

  const handleCitySelect = (city: CityAutocompleteResult | null) => {
    if (city) {
      // Include the city name, country information, and registered status in the URL as query parameters
      // Assume all cities are not registered unless explicitly marked as registered
      const isRegistered = city.registered === true;
      navigate(`/city/${city.wikidataId}?name=${encodeURIComponent(city.name)}&country=${encodeURIComponent(city.countryName)}&registered=${isRegistered}`);
      // Close the drawer when a city is selected
      setDrawerOpen(false);
    }
  };
  
  return (
    <>
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer(false)}
      >
        <Box
          sx={{ width: 250 }}
          role="presentation"
        >
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <img 
              src="/img/logo.png" 
              alt="City Vote Logo" 
              style={{ height: '40px', width: 'auto' }} 
            />
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              city-vote.com
            </Typography>
          </Box>
          <Divider />
          <List>
            <ListItem button onClick={() => {
              navigate('/');
              setDrawerOpen(false);
            }}>
              <ListItemIcon>
                <HomeIcon />
              </ListItemIcon>
              <ListItemText primary="Home" />
            </ListItem>
            <ListItem button onClick={() => {
              navigate('/about');
              setDrawerOpen(false);
            }}>
              <ListItemIcon>
                <InfoIcon />
              </ListItemIcon>
              <ListItemText primary="About" />
            </ListItem>
            <ListItem button onClick={() => {
              navigate('/polls');
              setDrawerOpen(false);
            }}>
              <ListItemIcon>
                <PollIcon />
              </ListItemIcon>
              <ListItemText primary="Polls" />
            </ListItem>
            <ListItem button onClick={() => {
              navigate('/register/city');
              setDrawerOpen(false);
            }}>
              <ListItemIcon>
                <AppRegistrationIcon />
              </ListItemIcon>
              <ListItemText primary="Register City" />
            </ListItem>
          </List>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Autocomplete
              sx={{ width: '100%', mb: 2 }}
              options={options}
              loading={loading}
              value={searchValue}
              onChange={(_, newValue) => {
                setSearchValue(newValue);
                handleCitySelect(newValue);
              }}
              onInputChange={(_, newInputValue) => {
                setInputValue(newInputValue);
              }}
              getOptionLabel={(option) => {
                // Include province/state if available
                if (option.stateProvinceLabel) {
                  return `${option.name}, ${option.stateProvinceLabel}, ${option.countryCode}`;
                }
                return `${option.name}, ${option.countryCode}`;
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search cities..."
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <SearchIcon color="action" sx={{ mr: 1 }} />
                        {params.InputProps.startAdornment}
                      </>
                    ),
                    endAdornment: (
                      <>
                        {loading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            {cityInfo && (
              <Button
                variant="contained"
                color="primary"
                onClick={onCreatePoll}
                fullWidth
                sx={{ mb: 2 }}
              >
                Create Poll
              </Button>
            )}
            {userEmail && !cityInfo && (
              <Box sx={{ mb: 2, px: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Logged in as:
                </Typography>
                <Typography variant="body1" fontWeight="medium">
                  {userEmail}
                </Typography>
              </Box>
            )}
            
            <Button
              variant="outlined"
              color="primary"
              fullWidth
              onClick={() => {
                if (cityInfo) {
                  onLogout();
                } else if (userEmail) {
                  handleUserLogout();
                } else {
                  navigate('/login/user');
                }
                setDrawerOpen(false);
              }}
              startIcon={cityInfo || userEmail ? <LogoutIcon /> : <LoginIcon />}
            >
              {cityInfo || userEmail ? 'Logout' : 'Login'}
            </Button>
          </Box>
        </Box>
      </Drawer>

      <Box
        component="header"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '64px',
          backgroundColor: cityInfo ? '#e3f2fd' : 'background.paper',
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
          {isMobile && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={toggleDrawer(true)}
            >
              <MenuIcon />
            </IconButton>
          )}
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
          <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
              
              {/* Mobile slogan moved to main content area */}
            </Box>
            <Typography 
              variant="body2" 
              component="div"
              onClick={() => navigate('/about')}
              sx={{ 
                color: 'text.secondary',
                textDecoration: 'none',
                marginRight: '12px',
                marginLeft: '12px',
                display: { xs: 'none', md: 'block' },
                cursor: 'pointer',
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
                display: { xs: 'none', md: 'block' },
                '&:hover': { 
                  color: 'primary.main',
                  textDecoration: 'underline'
                }
              }}
            >
              Polls
            </Typography>
            <Typography 
              variant="body2" 
              component="div"
              onClick={() => navigate('/register/city')}
              sx={{ 
                color: 'text.secondary',
                textDecoration: 'none',
                cursor: 'pointer',
                marginRight: '12px',
                display: { xs: 'none', md: 'block' },
                '&:hover': { 
                  color: 'primary.main',
                  textDecoration: 'underline'
                }
              }}
            >
              Register City
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Autocomplete
            sx={{ 
              width: '300px', 
              mx: 2,
              display: { xs: 'none', md: 'block' }
            }}
            options={options}
            loading={loading}
            value={searchValue}
            onChange={(_, newValue) => {
              setSearchValue(newValue);
              handleCitySelect(newValue);
            }}
            onInputChange={(_, newInputValue) => {
              setInputValue(newInputValue);
            }}
            getOptionLabel={(option) => {
              // Include province/state if available
              if (option.stateProvinceLabel) {
                return `${option.name}, ${option.stateProvinceLabel}, ${option.countryCode}`;
              }
              return `${option.name}, ${option.countryCode}`;
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Search 215000 cities and towns..."
                size="small"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <SearchIcon color="action" sx={{ mr: 1 }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {loading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          {/* User is logged in with city */}
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
          ) : userEmail ? (
            /* User is logged in without city */
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', textAlign: 'right', mr: 2 }}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                  {userEmail}
                </Typography>
              </Box>
              
              <IconButton 
                onClick={handleUserLogout}
                color="inherit"
                title="Logout"
              >
                <LogoutIcon />
              </IconButton>
            </>
          ) : (
            /* User is not logged in */
            <IconButton 
              onClick={() => navigate('/login/user')}
              color="inherit"
              title="Login"
            >
              <LoginIcon />
            </IconButton>
          )}
        </Box>
      </Box>
    </>
  );
}

export default Header;
