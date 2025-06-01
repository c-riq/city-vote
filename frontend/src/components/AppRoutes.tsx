import { Routes, Route } from 'react-router-dom';
import UserRegistration from './UserRegistration';
import UserLoginForm from './UserLoginForm';
import EmailVerification from './EmailVerification';
import CityRegistration from './CityRegistration';
import Polls from './Polls';
import Poll from './Poll';
import CityProfile from './CityProfile';
import CityNetworkProfile from './CityNetworkProfile';
import LandingPage from './LandingPage';
import About from './About';
import { VoteData } from '../backendTypes';

interface AppRoutesProps {
  isLoading: boolean;
  votesData: VoteData;
  fetchData: () => Promise<void>;
  fetchVotesOnly: () => Promise<void>;
}

function AppRoutes({
  isLoading,
  votesData,
  fetchData,
  fetchVotesOnly
}: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/register" element={<UserRegistration />} />
      <Route path="/register/user" element={<UserRegistration />} />
      <Route path="/register/city" element={<CityRegistration />} />
      <Route path="/verify" element={<EmailVerification />} />
      <Route path="/login/user" element={<UserLoginForm />} />
      <Route path="/polls" element={
        <Polls 
          votesData={votesData}
          onRefresh={fetchVotesOnly}
        />
      } />
      <Route path="/poll/:pollId" element={
        <Poll
          pollData={undefined}
          onVoteComplete={fetchData}
          votesData={votesData}
          isLoadingVotes={isLoading}
        />
      } />
      <Route path="/city/:cityId" element={<CityProfile />} />
      <Route path="/city-network/:networkId" element={<CityNetworkProfile />} />
      <Route path="/about" element={<About />} />
      <Route path="/" element={
        <LandingPage
          votesData={votesData}
          isLoading={isLoading}
        />
      } />
    </Routes>
  );
}

export default AppRoutes;
