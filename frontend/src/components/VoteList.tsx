import { Box, Typography, List, ListItem, ListItemText, Divider } from '@mui/material';
import { Link } from 'react-router-dom';

interface Vote {
  cityId: string;
  timestamp: number;
  option: string;
  voteInfo: {
    title: string;
    name: string;
    actingCapacity: 'individual' | 'representingCityAdministration';
  };
}

interface VoteListProps {
  votes: Vote[];
  cities: Record<string, any>;
  variant?: 'list' | 'cell';
  containerStyle?: React.CSSProperties;  // Optional container styles
}

const VoteList = ({ votes, cities, variant = 'list', containerStyle }: VoteListProps) => {
  const VoteContent = variant === 'cell' ? (
    <Box>
      {votes.map((vote, _) => (
        <Typography
          key={`${vote.cityId}-${vote.timestamp}`}
          variant="body2"
          color="text.secondary"
          component="div"
          sx={{ py: 0.5 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Link 
              to={`/city/${vote.cityId}`} 
              style={{ 
                color: 'inherit',
                textDecoration: 'none'
              }}
            >
              <Typography 
                component="span" 
                sx={{ 
                  fontWeight: 600,
                  color: 'primary.main',
                  fontSize: '1rem'
                }}
              >
                {cities?.[vote.cityId]?.name}, {cities?.[vote.cityId]?.country}
              </Typography>
            </Link>
            <Typography 
              component="span" 
              sx={{ 
                mx: 1,
                color: 'text.primary',
                fontWeight: 600,
                fontSize: '1rem'
              }}
            >
              voted <strong>{vote.option}</strong>
            </Typography>
          </Box>
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.85rem',
              mt: 0.5
            }}
          >
            {new Date(vote.timestamp).toLocaleDateString()} {new Date(vote.timestamp).toLocaleTimeString()} 
            {' · '}
            {vote.voteInfo.title} {vote.voteInfo.name}
            {' · '}
            <em>
              {vote.voteInfo.actingCapacity === 'individual' ? 
                'personal' : 
                'city admin'}
            </em>
          </Typography>
        </Typography>
      ))}
    </Box>
  ) : (
    <List sx={{ 
      bgcolor: 'background.default',
      borderRadius: 2,
      p: 0,
      overflow: 'hidden'
    }}>
      {votes.map((vote, index) => (
        <Box key={`${vote.cityId}-${vote.timestamp}`}>
          <ListItem sx={{ 
            py: 2,
            px: 3,
            bgcolor: index % 2 === 0 ? 'background.default' : 'background.paper'
          }}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Link 
                    to={`/city/${vote.cityId}`} 
                    style={{ 
                      color: 'inherit',
                      textDecoration: 'none'
                    }}
                  >
                    <Typography 
                      component="span" 
                      sx={{ 
                        fontWeight: 600,
                        color: 'primary.main',
                        fontSize: '1rem'
                      }}
                    >
                      {cities?.[vote.cityId]?.name}, {cities?.[vote.cityId]?.country}
                    </Typography>
                  </Link>
                  <Typography 
                    component="span" 
                    sx={{ 
                      mx: 1,
                      color: 'text.primary',
                      fontWeight: 600,
                      fontSize: '1rem'
                    }}
                  >
                    voted <strong>{vote.option}</strong>
                  </Typography>
                </Box>
              }
              secondary={
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'text.secondary',
                    fontSize: '0.85rem',
                    mt: 0.5
                  }}
                >
                  {new Date(vote.timestamp).toLocaleDateString()} {new Date(vote.timestamp).toLocaleTimeString()} 
                  {' · '}
                  {vote.voteInfo.title} {vote.voteInfo.name}
                  {' · '}
                  <em>
                    {vote.voteInfo.actingCapacity === 'individual' ? 
                      'personal' : 
                      'city admin'}
                  </em>
                </Typography>
              }
            />
          </ListItem>
          {index < votes.length - 1 && <Divider />}
        </Box>
      ))}
    </List>
  );

  return (
    <Box sx={containerStyle}>
      {VoteContent}
    </Box>
  );
};

export default VoteList; 