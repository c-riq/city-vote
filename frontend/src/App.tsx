import { useState, useEffect, useCallback } from 'react';
import { Container, Box } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import Header from './components/Header';
import AppRoutes from './components/AppRoutes';
import theme from './theme';
import { PUBLIC_API_HOST } from './constants';
import { GetVotesResponse, VoteData } from './backendTypes';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [votesData, setVotesData] = useState<VoteData>({});

  const fetchPublicData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch votes data
      const votesResponse = await fetch(`${PUBLIC_API_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getVotes' })
      });

      if (votesResponse.ok) {
        const votesData: GetVotesResponse = await votesResponse.json();
        setVotesData(votesData?.votes || {});
      }
    } catch (err) {
      console.error('Failed to fetch public data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-fetch public data on mount
  useEffect(() => {
    fetchPublicData();
  }, [fetchPublicData]);

  const fetchVotesOnly = async () => {
    try {
      const votesResponse = await fetch(`${PUBLIC_API_HOST}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getVotes' })
      });

      const votesData: GetVotesResponse = await votesResponse.json();

      if (!votesResponse.ok) {
        console.error(votesData.message || 'Failed to fetch votes');
        return;
      }

      setVotesData(votesData?.votes || {});
    } catch (err) {
      console.error('Failed to fetch votes:', err);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Box sx={{
          bgcolor: 'background.default',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <Header />
          <Container maxWidth="lg" sx={{ flex: 1, py: 0 }}>
          <AppRoutes
            isLoading={isLoading}
            votesData={votesData}
            fetchData={fetchPublicData}
            fetchVotesOnly={fetchVotesOnly}
          />
          </Container>
        </Box>
      </BrowserRouter>
      
    </ThemeProvider>
  );
}

export default App;
