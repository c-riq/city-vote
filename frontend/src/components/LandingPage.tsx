import { Link } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import WorldMap from './WorldMap';
import VoteList from './VoteList';
import { VoteData } from '../backendTypes';
import { getDisplayTitle, isJointStatement } from '../utils/pollFormat';
import useCityData from '../hooks/useCityData';

interface LandingPageProps {
  votesData: VoteData;
  isLoading: boolean;
  error?: string;
}

function LandingPage({ votesData, isLoading, error }: LandingPageProps) {
  // Use the city data hook to manage cities
  const {
    cities,
    isLoading: isCitiesLoading
  } = useCityData(votesData);
  const renderPollsPreview = () => {
    if (isLoading || isCitiesLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
          <Button variant="outlined" onClick={() => window.location.reload()} size="small">
            Try Again
          </Button>
        </Box>
      );
    }

    if (Object.entries(votesData).length === 0) {
      return (
        <Typography
          variant="body2"
          sx={{
            py: 4,
            color: 'text.secondary',
            textAlign: 'center',
          }}
        >
          No polls found.
        </Typography>
      );
    }

    // Show only the first 3 polls for preview
    const pollEntries = Object.entries(votesData).slice(0, 3);

    return (
      <Box sx={{ width: '100%' }}>
        {pollEntries.map(([pollId, pollData]) => {
          // Convert the new vote structure to the format expected by VoteList
          const allVotes = pollData.votes.map((vote) => {
            return {
              cityId: vote.associatedCityId || '',
              timestamp: vote.time || 0,
              option: vote.vote,
              voteInfo: {...vote.author, externalVerificationSource: vote.externalVerificationSource},
              city: vote.organisationNameFallback
            };
          })
          .sort((a, b) => b.timestamp - a.timestamp);
          
          // Truncate votes to 5 for preview
          const truncatedVotes = allVotes.slice(0, 5);
          const hasMoreVotes = allVotes.length > 5;
          
          return (
            <Box 
              key={pollId} 
              sx={{ 
                width: '100%',
                backgroundColor: 'background.paper',
                p: 2,
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                mb: 2,
                transition: 'transform 0.2s ease-in-out',
                '&:hover': {
                  transform: 'translateY(-1px)',
                }
              }}
            >
              <Link to={`/poll/${encodeURIComponent(pollId)}`} style={{ textDecoration: 'none' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 500, mb: 1 }}>
                    {getDisplayTitle(pollId)}
                  </Typography>
                  {pollId.includes('_attachment_') && (
                    <span 
                      className="material-icons" 
                      style={{ 
                        fontSize: '1rem', 
                        color: '#1a237e',
                        opacity: 0.7,
                        marginBottom: '8px'
                      }}
                      title="Has attachment"
                    >
                      attach_file
                    </span>
                  )}
                </Box>
              </Link>
              <VoteList 
                votes={truncatedVotes} 
                cities={cities} 
                variant="cell" 
                isJointStatement={isJointStatement(pollId)}
              />
              {hasMoreVotes && (
                <Box sx={{ mt: 1, textAlign: 'center' }}>
                  <Link to={`/poll/${encodeURIComponent(pollId)}`} style={{ textDecoration: 'none' }}>
                    <Button 
                      variant="text" 
                      size="small" 
                      endIcon={<span className="material-icons">arrow_forward</span>}
                    >
                      View all {allVotes.length} votes
                    </Button>
                  </Link>
                </Box>
              )}
            </Box>
          );
        })}
        
        {Object.entries(votesData).length > 3 && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Link to="/polls" style={{ textDecoration: 'none' }}>
              <Button variant="outlined" size="small">
                View All Polls
              </Button>
            </Link>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 3,
        pt: { xs: 12, sm: 12 }, // Increased top padding to account for header
        pb: 8, // Add bottom padding to account for fixed footer
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
        {/* World Map Section */}
        <Box sx={{
          width: '100%',
          height: { xs: '220px', sm: '400px', md: '500px', lg: '500px' },
          borderRadius: 4,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}>
          {/* Slogan for non-mobile screens */}
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

        {/* Polls Preview Section */}
        <Box sx={{
          width: '100%',
          maxWidth: 600,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          mb: 8 // Add bottom margin to prevent footer overlap
        }}>
          <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 500 }}>
            Recent Polls
          </Typography>
          {renderPollsPreview()}
        </Box>
      </Box>
      
      {/* Footer */}
      <Box sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: 'text.secondary',
        fontSize: '0.75rem',
        backgroundColor: 'background.default',
        borderTop: '1px solid',
        borderColor: 'divider',
        py: 1,
        px: 2,
        opacity: 0.95,
        backdropFilter: 'blur(8px)'
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

export default LandingPage;