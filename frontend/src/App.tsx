import { useState } from 'react';
import { Container } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import Header from './components/Header';
import CreatePollDialog from './components/CreatePollDialog';
import AppRoutes from './components/AppRoutes';
import { useAuth } from './hooks/useAuth';
import theme from './theme';

function App() {
  const {
    token,
    setToken,
    cityInfo,
    error,
    isLoading,
    votesData,
    cities,
    fetchData,
    fetchVotesOnly,
    handleLogout
  } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSubmit = () => {
    fetchData();
  };

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Header
          cityInfo={cityInfo}
          onLogout={handleLogout}
          onCreatePoll={() => setIsModalOpen(true)}
        />
        <Container sx={{ pt: '80px' }}>
          {cityInfo && (
            <CreatePollDialog
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              token={token}
            />
          )}
          <AppRoutes
            token={token}
            setToken={setToken}
            cityInfo={cityInfo}
            error={error}
            isLoading={isLoading}
            votesData={votesData}
            cities={cities}
            fetchData={fetchData}
            fetchVotesOnly={fetchVotesOnly}
            handleSubmit={handleSubmit}
          />
        </Container>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
