import { Routes, Route, Link } from 'react-router-dom';
import { Box, Button } from '@mui/material';
import Poll from './Poll';
import Polls from './Polls';
import CityInfoBox from './CityInfoBox';
import CityRegistration from './CityRegistration';
import CityProfile from './CityProfile';
import CityNetworkProfile from './CityNetworkProfile';
import LoginForm from './LoginForm';
import { City, VoteData } from '../backendTypes';

interface AppRoutesProps {
  token: string;
  setToken: (token: string) => void;
  cityInfo: City | null;
  error: string;
  isLoading: boolean;
  votesData: VoteData;
  cities: Record<string, City>;
  fetchData: () => Promise<void>;
  fetchVotesOnly: () => Promise<void>;
  handleSubmit: () => void;
}

function AppRoutes({
  token,
  setToken,
  cityInfo,
  error,
  isLoading,
  votesData,
  cities,
  fetchData,
  fetchVotesOnly,
  handleSubmit
}: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/register" element={<CityRegistration />} />
      <Route path="/polls" element={
        <Polls 
          token={token}
          cityInfo={cityInfo || undefined}
          votesData={votesData}
          cities={cities}
          onRefresh={fetchVotesOnly}
        />
      } />
      <Route path="/poll/:pollId" element={
        cityInfo ? (
          <Poll 
            token={token} 
            cityInfo={cityInfo} 
            pollData={undefined}
            onVoteComplete={fetchData}
            votesData={votesData}
            cities={cities}
          />
        ) : (
          <Poll 
            votesData={votesData}
            cities={cities}
          />
        )
      } />
      <Route path="/" element={
        !cityInfo ? (
          <LoginForm 
            token={token}
            setToken={setToken}
            error={error}
            isLoading={isLoading}
            handleSubmit={handleSubmit}
          />
        ) : (
          <Box
            sx={{
              padding: { xs: 2, sm: 4 },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              backgroundColor: 'background.default',
            }}
          >
            {/* Only show CityInfoBox for the logged-in user's own city information */}
            <CityInfoBox 
              cityId={cityInfo?.id || null} 
              cityInfo={cityInfo} 
              cities={cities} 
              token={token}
            />
            
            {/* Link to polls page */}
            <Box sx={{ 
              width: '100%',
              maxWidth: 800,
              display: 'flex',
              justifyContent: 'center',
              mt: 4
            }}>
              <Button
                component={Link}
                to="/polls"
                variant="contained"
                startIcon={<span className="material-icons">how_to_vote</span>}
                sx={{ px: 4, py: 1.5 }}
              >
                View All Polls
              </Button>
            </Box>
          </Box>
        )
      } />
      <Route 
        path="/city/:cityId" 
        element={<CityProfile />}
      />
      <Route 
        path="/network/:networkId" 
        element={<CityNetworkProfile />}
      />
    </Routes>
  );
}

export default AppRoutes;
