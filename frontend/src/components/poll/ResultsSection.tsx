import { Box, Typography, Divider } from '@mui/material';
import VoteList from '../VoteList';
import { City, VoteAuthor } from '../../backendTypes';

interface Vote {
  cityId: string;
  timestamp: number;
  option: string;
  city?: string;
  voteInfo: VoteAuthor & {
    externallyVerifiedBy?: string;
  };
}

interface ResultsSectionProps {
  votesByOption: Record<string, number>;
  allVotes: Vote[];
  cities: Record<string, City>;
  isJointStatement: boolean;
}

function ResultsSection({ votesByOption, allVotes, cities, isJointStatement }: ResultsSectionProps) {
  return (
    <>
      {/* Results summary */}
      <Box sx={{ 
        mb: 4, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        gap: 2
      }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          {isJointStatement ? 'Signatures' : 'Results'}
        </Typography>
        
        {Object.entries(votesByOption).length > 0 ? (
          Object.entries(votesByOption).map(([option, count]) => (
            <Box 
              key={option}
              sx={{
                width: '100%',
                maxWidth: 400,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                borderRadius: 2,
                bgcolor: 'background.default'
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {isJointStatement && option === 'Sign' ? 'Signed' : option}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 700 }}>
                {count} {isJointStatement ? 'signature' : 'vote'}{count !== 1 ? 's' : ''}
              </Typography>
            </Box>
          ))
        ) : (
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            {isJointStatement ? 'No signatures yet' : 'No votes yet'}
          </Typography>
        )}
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Typography 
        variant="h6" 
        sx={{ 
          mb: 3,
          color: 'primary.main',
          fontWeight: 500
        }}
      >
        {isJointStatement ? 'Signature History' : 'Voting History'}
      </Typography>
      
      <VoteList 
        votes={allVotes}
        cities={cities}
        variant="list"
        isJointStatement={isJointStatement}
      />
    </>
  );
}

export default ResultsSection;
