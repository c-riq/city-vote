import { Box, Typography, List, ListItem, ListItemText, Divider } from '@mui/material';
import { Link } from 'react-router-dom';
import { VoteAuthor, City } from '../backendTypes';

// Interface for the transformed vote data used in this component
interface Vote {
  cityId: string;
  timestamp: number;
  option: string;
  city?: string;
  voteInfo: VoteAuthor & {
    externallyVerifiedBy?: string; // Platform that verified this vote
  };
}

interface VoteListProps {
  votes: Vote[];
  cities: Record<string, City>;
  variant?: 'list' | 'cell' | 'compact';
  containerStyle?: React.CSSProperties;  // Optional container styles
  isJointStatement?: boolean;  // Flag to indicate if this is a joint statement poll
}

const VoteList = ({ votes, cities, variant = 'list', containerStyle, isJointStatement = false }: VoteListProps) => {
  // Compact variant for a more condensed view
  if (variant === 'compact') {
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
                        {vote.voteInfo?.externallyVerifiedBy && (
                          <span style={{ 
                            backgroundColor: '#e3f2fd', 
                            padding: '1px 4px', 
                            borderRadius: '3px',
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            color: '#0d47a1',
                            marginLeft: '4px'
                          }}>
                            ✓
                          </span>
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
  }

  const VoteContent = variant === 'cell' ? (
    <Box>
      {votes.map((vote, index) => (
        <Typography
          key={`${vote.cityId || 'anonymous'}-${vote.timestamp || 0}-${vote.voteInfo?.name || ''}-${vote.voteInfo?.title || ''}-${index}`}
          variant="body2"
          color="text.secondary"
          component="div"
          sx={{ py: 0.5 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                    fontSize: '1rem'
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
                  fontSize: '1rem',
                  fontStyle: 'italic'
                }}
              >
                {vote.city || 'Unknown city'}
              </Typography>
            )}
              <Typography 
                component="span" 
                sx={{ 
                  mx: 1,
                  color: 'text.primary',
                  fontWeight: 600,
                  fontSize: '1rem'
                }}
              >
                {isJointStatement ? '' : `voted `}<strong>{!isJointStatement && vote.option}</strong>
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
            {vote.timestamp ? `${new Date(vote.timestamp).toLocaleDateString()} ${new Date(vote.timestamp).toLocaleTimeString()}` : 'Unknown date'} 
            {' · '}
            {vote.voteInfo?.title || ''} {vote.voteInfo?.name || 'Unknown'}
            {' · '}
            <span style={{
              backgroundColor: vote.voteInfo?.actingCapacity === 'individual' ? '#f3e5f5' : '#e8f5e9',
              padding: '1px 4px',
              borderRadius: '3px',
              fontSize: '0.75rem',
              fontWeight: 500,
              color: vote.voteInfo?.actingCapacity === 'individual' ? '#6a1b9a' : '#2e7d32'
            }}>
              {vote.voteInfo?.actingCapacity === 'individual' ? 'Personal Vote' : 'Official Vote'}
            </span>
            {vote.voteInfo?.externallyVerifiedBy && (
              <>
                {' · '}
                <span style={{ 
                  backgroundColor: '#e3f2fd', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#0d47a1'
                }}>
                  Verified by {vote.voteInfo?.externallyVerifiedBy}
                </span>
              </>
            )}
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
        <Box key={`${vote.cityId || 'anonymous'}-${vote.timestamp || 0}-${vote.voteInfo?.name || ''}-${vote.voteInfo?.title || ''}-${index}`}>
          <ListItem sx={{ 
            py: 1.5,
            px: 2.5,
            bgcolor: index % 2 === 0 ? 'background.default' : 'background.paper'
          }}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                          fontSize: '1rem'
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
                        fontSize: '1rem',
                        fontStyle: 'italic'
                      }}
                    >
                      {vote.city || 'Unknown city'}
                    </Typography>
                  )}
                  <Typography 
                    component="span" 
                    sx={{ 
                      mx: 1,
                      color: 'text.primary',
                      fontWeight: 600,
                      fontSize: '1rem'
                    }}
                  >
                    {isJointStatement ? '' : `voted `}<strong>{!isJointStatement && vote.option}</strong>
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
                  {vote.timestamp ? `${new Date(vote.timestamp).toLocaleDateString()} ${new Date(vote.timestamp).toLocaleTimeString()}` : 'Unknown date'} 
                  {' · '}
                  {vote.voteInfo?.title || ''} {vote.voteInfo?.name || 'Unknown'}
                  {' · '}
                  <span style={{
                    backgroundColor: vote.voteInfo?.actingCapacity === 'individual' ? '#f3e5f5' : '#e8f5e9',
                    padding: '1px 4px',
                    borderRadius: '3px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: vote.voteInfo?.actingCapacity === 'individual' ? '#6a1b9a' : '#2e7d32'
                  }}>
                    {vote.voteInfo?.actingCapacity === 'individual' ? 'Personal Vote' : 'Official Vote'}
                  </span>
                  {vote.voteInfo?.externallyVerifiedBy && (
                    <>
                      {' · '}
                      <span style={{ 
                        backgroundColor: '#e3f2fd', 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: '#0d47a1'
                      }}>
                        Verified by {vote.voteInfo?.externallyVerifiedBy}
                      </span>
                    </>
                  )}
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
