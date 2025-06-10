import { Box, FormControl, RadioGroup, FormControlLabel, Radio, TextField, Typography } from '@mui/material';
import { City } from '../../backendTypes';

interface VoteFormProps {
  cityInfo?: City | null;
  isPersonal: boolean;
  setIsPersonal: (isPersonal: boolean) => void;
  personalInfo: { title: string; name: string };
  setPersonalInfo: (personalInfo: { title: string; name: string }) => void;
}

function VoteForm({ cityInfo, isPersonal, setIsPersonal, personalInfo, setPersonalInfo }: VoteFormProps) {
  return (
    <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <Typography variant="subtitle1" sx={{ mb: 2 }}>Vote as:</Typography>
      <FormControl>
        <RadioGroup
          value={isPersonal ? 'personal' : 'city'}
          onChange={(e) => setIsPersonal(e.target.value === 'personal')}
          sx={{ mb: 2 }}
        >
          <FormControlLabel
            value="city"
            control={<Radio />}
            label={<>On behalf of the City Administration{cityInfo?.name ? ` of ${cityInfo.name}` : ''}</>}
            disabled={!cityInfo}
          />
          <FormControlLabel 
            value="personal"
            control={<Radio />} 
            label={<>As a <strong>person</strong> expressing their own opinion</>}
          />
        </RadioGroup>
      </FormControl>

      <Box sx={{ mt: 3, width: '100%', maxWidth: 400 }}>
        <TextField
          fullWidth
          required
          label="Title"
          value={personalInfo.title}
          onChange={(e) => setPersonalInfo({ ...personalInfo, title: e.target.value })}
          margin="normal"
          size="small"
        />
        <TextField
          fullWidth
          required
          label="Name"
          value={personalInfo.name}
          onChange={(e) => setPersonalInfo({ ...personalInfo, name: e.target.value })}
          margin="normal"
          size="small"
        />
      </Box>
    </Box>
  );
}

export default VoteForm;
