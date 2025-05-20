import { Box, Button, Link as MuiLink } from '@mui/material';

interface PollAttachmentProps {
  attachmentUrl: string;
}

function PollAttachment({ attachmentUrl }: PollAttachmentProps) {
  return (
    <>
      {/* Embedded PDF viewer */}
      <Box sx={{ 
        width: '100%',
        height: '500px',
        mb: 4,
        mt: 2,
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: 2,
        overflow: 'hidden'
      }}>
        <iframe
          src={`${attachmentUrl}#toolbar=0&navpanes=0`}
          width="100%"
          height="100%"
          style={{ border: 'none' }}
          title="PDF Attachment"
        />
      </Box>
      
      {/* Button to open in new tab */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        mb: 4
      }}>
        <Button
          variant="outlined"
          startIcon={<span className="material-icons">open_in_new</span>}
          component={MuiLink}
          href={attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ 
            textTransform: 'none',
            borderRadius: 2,
            px: 3
          }}
        >
          Open PDF in New Tab
        </Button>
      </Box>
    </>
  );
}

export default PollAttachment;
