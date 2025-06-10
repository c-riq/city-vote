import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
import { City } from '../../backendTypes';

interface ConfirmVoteDialogProps {
  open: boolean;
  option: string | null;
  isPersonal: boolean;
  personalInfo: { title: string; name: string };
  isJointStatement: boolean;
  hasVoted: boolean;
  cityInfo?: City | null;
  onClose: () => void;
  onConfirm: () => void;
}

function ConfirmVoteDialog({
  open,
  option,
  isPersonal,
  personalInfo,
  isJointStatement,
  hasVoted,
  cityInfo,
  onClose,
  onConfirm
}: ConfirmVoteDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
    >
      <DialogTitle>{isJointStatement ? 'Confirm Signature' : 'Confirm Vote'}</DialogTitle>
      <DialogContent>
        <Typography>
          {isJointStatement ? (
            <>
              Are you sure you want to sign this document{' '}
              {isPersonal ? (
                <>as a <strong>personal</strong> signature from {personalInfo.title} <strong>{personalInfo.name}</strong></>
              ) : (
                <>on <strong>behalf of the City Administration </strong> as {personalInfo.title} <strong>{personalInfo.name}</strong></>
              )}?
            </>
          ) : (
            <>
              Are you sure you want to vote "<strong>{option}</strong>"{' '}
              {isPersonal ? (
                <>as a <strong>personal</strong> vote from {personalInfo.title} <strong>{personalInfo.name}</strong></>
              ) : (
                <>on <strong>behalf of the City Administration </strong> as {personalInfo.title} <strong>{personalInfo.name}</strong></>
              )}?
            </>
          )}
        </Typography>
        {hasVoted && !isPersonal && cityInfo && (
          <Typography
            sx={{ mt: 2, color: 'warning.main' }}
          >
            Note: {cityInfo.name} has already {isJointStatement ? 'signed this document' : 'voted on this poll'}. 
            This will add another {isJointStatement ? 'signature' : 'vote'} to the history.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onClose}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="primary"
          autoFocus
          disabled={!personalInfo.title || !personalInfo.name}
        >
          {isJointStatement ? 'Confirm Signature' : 'Confirm Vote'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmVoteDialog;
