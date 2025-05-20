import { Box, TextField, Button, Typography } from '@mui/material';
import WorldMap from './WorldMap';

interface LoginFormProps {
  token: string;
  setToken: (token: string) => void;
  error: string;
  isLoading: boolean;
  handleSubmit: () => void;
}

function LoginForm({ token, setToken, error, isLoading, handleSubmit }: LoginFormProps) {
  return (
    <Box
      sx={{
        height: 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 3,
        overflow: 'hidden',
        pt: { xs: 4, sm: 6 },
        backgroundColor: 'background.default',
      }}
    >
      {/* Small slogan for mobile screens */}
      <Typography 
        variant="caption" 
        sx={{ 
          display: { xs: 'block', md: 'none' },
          color: '#1a237e',
          fontWeight: 300,
          letterSpacing: '0.05em',
          fontSize: '0.75rem',
          fontFamily: '"Helvetica Neue", Arial, sans-serif',
          mt: -3,
          mb: -1,
          opacity: 0.7,
          textAlign: 'center'
        }}
      >
        Local Government Coordination
      </Typography>
      <Box sx={{ 
        width: '100%',
        maxWidth: '1000px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: { xs: 2, sm: 3 }
      }}>
        <Box sx={{ 
          width: '100%', 
          height: { xs: '250px', sm: '450px' },
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}>
          {/* Slogan for non-mobile screens (no box) */}
          <Typography 
            variant="h6" 
            sx={{ 
              position: 'absolute',
              top: { xs: 0, sm: 0 },
              zIndex: 10,
              color: '#1a237e',
              fontWeight: 300,
              textAlign: 'center',
              letterSpacing: '0.12em',
              textTransform: 'none',
              fontFamily: '"Helvetica Neue", Arial, sans-serif',
              display: { xs: 'none', md: 'block' }
            }}
          >
            Local Government Coordination
          </Typography>
          <WorldMap />
        </Box>
        <Typography 
          variant="body1" 
          sx={{ 
            mb: 2,
            color: 'text.secondary',
            textAlign: 'center',
            maxWidth: 600,
            px: 2,
          }}
        >
          Please enter your city access token
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          maxWidth: 400, 
          width: '100%',
          px: { xs: 2, sm: 0 }
        }}>
          <TextField
            label="Access Token"
            variant="outlined"
            fullWidth
            autoComplete="off"
            inputProps={{
              autoComplete: 'off',
              'data-form-type': 'other',
            }}
            sx={{ 
              '& input': { fontSize: '0.9rem' },
              '& .MuiOutlinedInput-root': {
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
              }
            }}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            error={!!error}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                handleSubmit();
              }
            }}
          />
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={isLoading}
            sx={{ 
              height: '56px', 
              minWidth: '120px',
              px: 6,
              backgroundColor: 'primary.dark',
              '&:hover': {
                backgroundColor: 'primary.main',
              },
              textTransform: 'none',
              boxShadow: 2,
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            }}
            startIcon={<span className="material-icons">key</span>}
          >
            {isLoading ? 'Validating...' : 'Authenticate'}
          </Button>
        </Box>
        {error && (
          <Typography 
            color="error" 
            sx={{ 
              maxWidth: 400, 
              textAlign: 'center',
              backgroundColor: 'error.light',
              color: 'error.contrastText',
              padding: 1,
              borderRadius: 1,
              width: '100%',
              mx: { xs: 2, sm: 0 }
            }}
          >
            {error}
          </Typography>
        )}
      </Box>
      
      <Box sx={{ 
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        color: 'text.secondary',
        fontSize: '0.75rem',
        opacity: 0.7
      }}>
        <Typography variant="caption" component="span">
          Rix Data NL B.V. · Herengracht 551, 1017 BW Amsterdam · KVK 88818306 · 
        </Typography>
        <a
          href="https://github.com/c-riq/city-vote"
          target="_blank"
          rel="noopener noreferrer"
          style={{ 
            color: 'inherit',
            textDecoration: 'none'
          }}
          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
        >
          <Typography variant="caption" component="span">
            Source code
          </Typography>
        </a>
      </Box>
    </Box>
  );
}

export default LoginForm;
