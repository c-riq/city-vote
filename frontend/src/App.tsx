import { Button, Container, Typography, TextField, Box } from '@mui/material';

function App() {
  // For demo purposes, assuming not logged in
  const isLoggedIn = false;

  return (
    <Container>
      {isLoggedIn ? (
        <>
          <Typography variant="h1">Hello, World!</Typography>
          <Button variant="contained">Click me</Button>
        </>
      ) : (
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2
          }}
        >
          <Typography variant="h4">Please enter your access token</Typography>
          <TextField
            label="Access Token"
            variant="outlined"
            fullWidth
            sx={{ maxWidth: 400 }}
          />
          <Button variant="contained">Submit</Button>
        </Box>
      )}
    </Container>
  );
}

export default App;