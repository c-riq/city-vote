import { Box, Button, CircularProgress } from '@mui/material';

interface VoteButtonsProps {
  isJointStatement: boolean;
  options: string[];
  onVote: (option: string) => void;
  disabled: boolean;
  isVoting?: boolean;
}

function VoteButtons({ isJointStatement, options, onVote, disabled, isVoting = false }: VoteButtonsProps) {
  return (
    <Box sx={{ 
      display: 'flex', 
      gap: 2, 
      flexDirection: 'column', 
      mb: 6,
      maxWidth: 400,
      mx: 'auto'
    }}>
      {isJointStatement ? (
        // For joint statements, only show "Sign Document" option
        <Button
          variant="contained"
          onClick={() => onVote("Sign")}
          disabled={disabled}
          sx={{
            py: 1.5,
            fontSize: '1.1rem',
            backgroundColor: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.dark',
            }
          }}
          startIcon={
            isVoting ? (
              <CircularProgress size={20} sx={{ color: 'white' }} />
            ) : (
              <span className="material-icons">how_to_reg</span>
            )
          }
        >
          {isVoting ? 'Signing...' : 'Sign Document'}
        </Button>
      ) : (
        // For regular polls, show Yes/No options
        options.map((option: string, index: number) => (
          <Button
            key={index}
            variant="contained"
            onClick={() => onVote(option)}
            disabled={disabled}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              backgroundColor: index === 0 ? 'primary.main' : 'primary.light',
              '&:hover': {
                backgroundColor: index === 0 ? 'primary.dark' : 'primary.main',
              }
            }}
            startIcon={
              isVoting ? (
                <CircularProgress size={20} sx={{ color: 'white' }} />
              ) : undefined
            }
          >
            {isVoting ? 'Voting...' : option}
          </Button>
        ))
      )}
    </Box>
  );
}

export default VoteButtons;
