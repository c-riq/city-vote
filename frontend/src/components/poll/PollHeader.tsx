import { Box, Typography, Button, Link as MuiLink } from '@mui/material';

interface PollHeaderProps {
  title: string;
  isJointStatement: boolean;
  organisedBy?: string | null;
  documentUrl?: string | null;
}

function PollHeader({ title, isJointStatement, organisedBy, documentUrl }: PollHeaderProps) {
  return (
    <>
      <Typography 
        variant="h4" 
        sx={{ 
          mb: 2,
          color: 'primary.main',
          textAlign: 'center',
          fontWeight: 600
        }}
      >
        {title}
      </Typography>
      
      {/* Display organised by information if available */}
      {isJointStatement && organisedBy && (
        <Typography 
          variant="subtitle1" 
          sx={{ 
            mb: 3,
            textAlign: 'center',
            color: 'text.secondary'
          }}
        >
          Organised by: {organisedBy}
        </Typography>
      )}
      
      {/* Display document URL if available */}
      {isJointStatement && documentUrl && (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mb: 4,
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Document URL:
          </Typography>
          <Button
            variant="outlined"
            startIcon={<span className="material-icons">open_in_new</span>}
            component={MuiLink}
            href={documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ 
              textTransform: 'none',
              borderRadius: 2,
              px: 3
            }}
          >
            Open Document
          </Button>
        </Box>
      )}
    </>
  );
}

export default PollHeader;
