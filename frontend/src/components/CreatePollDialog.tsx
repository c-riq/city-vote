import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Typography 
} from '@mui/material';
import { VOTE_HOST } from '../constants';

interface CreatePollDialogProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

function CreatePollDialog({ isOpen, onClose, token }: CreatePollDialogProps) {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [isCreatingPoll, setIsCreatingPoll] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [pollType, setPollType] = useState<'regular' | 'jointStatement'>('regular');
  const [useUrl, setUseUrl] = useState(false);
  const [documentUrl, setDocumentUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [organisedBy, setOrganisedBy] = useState('');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    
    if (file) {
      if (file.type !== 'application/pdf') {
        setAttachmentError('Only PDF files are allowed');
        setAttachment(null);
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setAttachmentError('File size must be less than 10MB');
        setAttachment(null);
        return;
      }
      
      setAttachmentError('');
      setAttachment(file);
    } else {
      setAttachment(null);
    }
  };

  // Helper function to create a URL-safe base64 SHA-256 hash
  const createAttachmentId = async (pollQuestion: string): Promise<string> => {
    // Use the SubtleCrypto API to create a SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(pollQuestion);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert the hash to a base64 string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashBase64 = btoa(String.fromCharCode(...hashArray));
    
    // Make it URL-safe by replacing characters
    return hashBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const handleCreatePoll = async () => {
    // Validate inputs based on poll type
    if (pollType === 'regular' && !question.trim()) {
      return; // Regular polls require a question
    }
    
    if (pollType === 'jointStatement') {
      if (useUrl) {
        // URL validation for joint statements
        if (!documentUrl.trim()) {
          setUrlError('Document URL is required');
          return;
        }
        
        // Basic URL validation
        try {
          new URL(documentUrl);
          setUrlError('');
        } catch (e) {
          setUrlError('Please enter a valid URL');
          return;
        }
      } else if (!attachment) {
        // PDF is required when not using URL
        return;
      }
    }
    
    setIsCreatingPoll(true);
    try {
      // Prepare the poll ID
      let basePollId = question.trim();
      if (pollType === 'jointStatement') {
        // For joint statements, handle the ID differently
        if (!basePollId || basePollId === 'Joint Statement') {
          // If no title or default title, just use the prefix with trailing underscore
          basePollId = 'joint_statement_';
        } else {
          // Otherwise, add the prefix to the custom title
          basePollId = `joint_statement_${basePollId}`;
        }
      }
      
      // Handle document based on type
      if (pollType === 'jointStatement') {
        if (useUrl) {
          // Create the poll with the URL as a separate field
          const response = await fetch(VOTE_HOST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'createPoll',
              token,
              pollId: basePollId,
              documentUrl,
              organisedBy: organisedBy.trim() || undefined
            })
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to create poll');
          }

          onClose();
          const encodedQuestion = encodeURIComponent(basePollId);
          navigate(`/poll/${encodedQuestion}`);
          resetForm();
          return;
        } else if (attachment) {
          // For PDF-based joint statements
          const attachmentId = await createAttachmentId(basePollId);
          
          // First, get the presigned URL
          const getUrlResponse = await fetch(VOTE_HOST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'uploadAttachment',
              token,
              pollId: basePollId,
              attachmentId
            })
          });

          if (!getUrlResponse.ok) {
            const data = await getUrlResponse.json();
            throw new Error(data.message || 'Failed to get upload URL');
          }

          const urlData = await getUrlResponse.json();
          
          if (!urlData.uploadUrl) {
            throw new Error('No upload URL provided');
          }
          
          // Then, upload the file directly to S3 using the presigned URL
          const uploadResponse = await fetch(urlData.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/pdf'
            },
            body: attachment
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload attachment to S3');
          }
          
          // Use the formatted pollId returned from the backend (which includes _attachment_<hash>)
          if (urlData.pollId) {
            // Create the poll with the formatted pollId
            const response = await fetch(VOTE_HOST, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'createPoll',
                token,
                pollId: urlData.pollId,
                documentUrl: null,
                organisedBy: organisedBy.trim() || undefined
              })
            });

            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.message || 'Failed to create poll');
            }

            onClose();
            const encodedQuestion = encodeURIComponent(urlData.pollId);
            navigate(`/poll/${encodedQuestion}`);
            resetForm();
            return;
          }
        }
      } else if (attachment) {
        // Handle regular poll with attachment
        const attachmentId = await createAttachmentId(basePollId);
        
        // First, get the presigned URL
        const getUrlResponse = await fetch(VOTE_HOST, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'uploadAttachment',
            token,
            pollId: basePollId,
            attachmentId
          })
        });

        if (!getUrlResponse.ok) {
          const data = await getUrlResponse.json();
          throw new Error(data.message || 'Failed to get upload URL');
        }

        const urlData = await getUrlResponse.json();
        
        if (!urlData.uploadUrl) {
          throw new Error('No upload URL provided');
        }
        
        // Then, upload the file directly to S3 using the presigned URL
        const uploadResponse = await fetch(urlData.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/pdf'
          },
          body: attachment
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload attachment to S3');
        }
        
        // Use the formatted pollId returned from the backend (which includes _attachment_<hash>)
        if (urlData.pollId) {
          // Create the poll with the formatted pollId
          const response = await fetch(VOTE_HOST, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'createPoll',
              token,
              pollId: urlData.pollId,
              documentUrl: null,
              organisedBy: organisedBy.trim() || undefined
            })
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to create poll');
          }

          onClose();
          const encodedQuestion = encodeURIComponent(urlData.pollId);
          navigate(`/poll/${encodedQuestion}`);
          resetForm();
          return;
        }
      }

      // If no attachment or no pollId returned, create the poll with the original question
      const response = await fetch(VOTE_HOST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createPoll',
          token,
          pollId: basePollId,
          documentUrl: null,
          organisedBy: organisedBy.trim() || undefined
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create poll');
      }

      onClose();
      const encodedQuestion = encodeURIComponent(basePollId);
      navigate(`/poll/${encodedQuestion}`);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create poll');
    } finally {
      setIsCreatingPoll(false);
    }
  };

  const resetForm = () => {
    setQuestion('');
    setAttachment(null);
    setAttachmentError('');
    setPollType('regular');
    setUseUrl(false);
    setDocumentUrl('');
    setUrlError('');
    setOrganisedBy('');
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle component="div" sx={{ pb: 2, pt: 3, px: 3 }}>
        Create New Poll
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 3 }}>
        {/* Poll Type Selection */}
        <Box sx={{ mb: 3, mt: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Poll Type
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant={pollType === 'regular' ? 'contained' : 'outlined'}
              onClick={() => setPollType('regular')}
              sx={{ flex: 1 }}
            >
              Regular Poll
            </Button>
            <Button
              variant={pollType === 'jointStatement' ? 'contained' : 'outlined'}
              onClick={() => setPollType('jointStatement')}
              sx={{ flex: 1 }}
            >
              Joint Statement
            </Button>
          </Box>
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
            {pollType === 'regular' 
              ? 'Create a standard poll with Yes/No voting options.' 
              : 'Create a joint statement that cities can sign. Requires a PDF document.'}
          </Typography>
        </Box>

        {/* Question Field */}
        <TextField
          fullWidth
          label={pollType === 'regular' ? "Question" : "Statement Title"}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          margin="normal"
          required={pollType === 'regular'}
          helperText={pollType === 'jointStatement' ? "Optional for joint statements" : ""}
        />

        {/* Attachment Field */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {pollType === 'regular' ? 'Attachment (Optional)' : 'Document (Required)'}
          </Typography>
          
          {/* URL or PDF selection for joint statements */}
          {pollType === 'jointStatement' && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                Choose document type:
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant={!useUrl ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setUseUrl(false)}
                >
                  PDF Upload
                </Button>
                <Button
                  variant={useUrl ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setUseUrl(true)}
                >
                  URL Link
                </Button>
              </Box>
            </Box>
          )}
          
          {/* URL input field */}
          {pollType === 'jointStatement' && useUrl && (
            <TextField
              fullWidth
              label="Document URL"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              margin="normal"
              placeholder="https://example.com/document.pdf"
              required
              error={!!urlError}
              helperText={urlError || "Enter the URL to the document"}
            />
          )}
          
          {/* PDF upload field */}
          {(!useUrl || pollType === 'regular') && (
            <>
              <input
                accept="application/pdf"
                style={{ display: 'none' }}
                id="attachment-file"
                type="file"
                onChange={handleFileChange}
              />
              <label htmlFor="attachment-file">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<span className="material-icons">attach_file</span>}
                >
                  {attachment ? 'Change PDF' : 'Upload PDF'}
                </Button>
              </label>
              {attachment && (
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                  Selected: {attachment.name} ({Math.round(attachment.size / 1024)} KB)
                </Typography>
              )}
              {attachmentError && (
                <Typography variant="body2" sx={{ mt: 1, color: 'error.main' }}>
                  {attachmentError}
                </Typography>
              )}
              {pollType === 'jointStatement' && !attachment && !useUrl && (
                <Typography variant="body2" sx={{ mt: 1, color: 'warning.main' }}>
                  A PDF document is required for joint statements
                </Typography>
              )}
            </>
          )}
        </Box>
        
        {/* Organised By Field (only for joint statements) */}
        {pollType === 'jointStatement' && (
          <TextField
            fullWidth
            label="Organised By"
            value={organisedBy}
            onChange={(e) => setOrganisedBy(e.target.value)}
            margin="normal"
            placeholder="Optional: Organisation or entity that organised this joint statement"
            helperText="Optional field to indicate who organised this joint statement"
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleCancel}>Cancel</Button>
        <Button 
          onClick={handleCreatePoll}
          disabled={
            isCreatingPoll || 
            (pollType === 'regular' && !question.trim()) || 
            (pollType === 'jointStatement' && !useUrl && !attachment) ||
            (pollType === 'jointStatement' && useUrl && !documentUrl.trim())
          }
        >
          {isCreatingPoll ? 'Creating...' : 'Create Poll'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CreatePollDialog;
