import { Box, Typography, List, ListItem, ListItemText, Divider, Link as MuiLink } from '@mui/material';
import { Link } from 'react-router-dom';
import { VoteAuthor, City } from '../backendTypes';

interface Vote {
  cityId: string;
  timestamp: number;
  option: string;
  city?: string;
  voteInfo: VoteAuthor & {
    externalVerificationSource?: string;
  };
}

interface VoteListProps {
  votes: Vote[];
  cities: Record<string, City>;
  containerStyle?: React.CSSProperties;  // Optional container styles
  isJointStatement?: boolean;  // Flag to indicate if this is a joint statement poll
  variant?: string; // Kept for backward compatibility but not used
}

const VoteList = ({ votes, cities, containerStyle, isJointStatement = false }: VoteListProps) => {
  return (
    <Box sx={containerStyle}>
      <List sx={{ 
        bgcolor: 'background.default',
        borderRadius: 2,
        p: 0,
        overflow: 'hidden'
      }}>
        {votes.map((vote, index) => (
          <Box key={`${vote.cityId || 'anonymous'}-${vote.timestamp || 0}-${vote.voteInfo?.name || ''}-${vote.voteInfo?.title || ''}-${index}`}>
            <ListItem sx={{ 
              py: 1,
              px: 2,
              bgcolor: index % 2 === 0 ? 'background.default' : 'background.paper',
              minHeight: '40px'
            }}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                    {vote.cityId && cities?.[vote.cityId] ? (
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
                            fontSize: '0.875rem'
                          }}
                        >
                          {`${cities[vote.cityId].name}, ${cities[vote.cityId].country}`}
                        </Typography>
                      </Link>
                    ) : (
                      <Typography 
                        component="span" 
                        sx={{ 
                          fontWeight: 600,
                          color: 'text.secondary',
                          fontSize: '0.875rem',
                          fontStyle: 'italic'
                        }}
                      >
                        {vote.city || 'Unknown city'}
                      </Typography>
                    )}
                    <Typography 
                      component="span" 
                      sx={{ 
                        color: 'text.primary',
                        fontWeight: 500,
                        fontSize: '0.875rem'
                      }}
                    >
                      {isJointStatement ? '' : `voted `}<strong>{!isJointStatement && vote.option}</strong>
                    </Typography>
                    <Typography 
                      component="span" 
                      sx={{ 
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        ml: 'auto'
                      }}
                    >
                      {vote.voteInfo?.title || ''} {vote.voteInfo?.name || 'Unknown'} 
                      {' · '}
                      <span style={{
                        backgroundColor: vote.voteInfo?.actingCapacity === 'individual' ? '#f3e5f5' : '#e8f5e9',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontSize: '0.7rem',
                        fontWeight: 500,
                        color: vote.voteInfo?.actingCapacity === 'individual' ? '#6a1b9a' : '#2e7d32'
                      }}>
                        {vote.voteInfo?.actingCapacity === 'individual' ? 'Personal capacity' : 'Representing organisation'}
                      </span>
                      {vote.voteInfo?.externalVerificationSource && (
                        <MuiLink 
                          href={vote.voteInfo.externalVerificationSource}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ 
                            textDecoration: 'none',
                            marginLeft: '4px',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <span style={{ 
                            backgroundColor: '#e3f2fd', 
                            padding: '1px 4px', 
                            borderRadius: '3px',
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            color: '#0d47a1',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}>
                            External verification <span style={{ fontSize: '0.6rem' }}>↗</span>
                          </span>
                        </MuiLink>
                      )}
                    </Typography>
                  </Box>
                }
                sx={{ my: 0 }}
              />
            </ListItem>
            {index < votes.length - 1 && <Divider />}
          </Box>
        ))}
      </List>
    </Box>
  );
};

export default VoteList;
