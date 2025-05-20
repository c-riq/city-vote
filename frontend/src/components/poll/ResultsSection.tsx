import { Box, Typography, Divider } from '@mui/material';
import VoteList from '../VoteList';
import { City, VoteAuthor } from '../../backendTypes';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Tooltip } from '@mui/material';
import countryBorders from '../countryBorders.json';

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
      
      {/* Map showing cities that have voted/signed */}
      {allVotes.length > 0 && (
        <Box sx={{ 
          width: '100%', 
          height: '300px',
          mb: 4,
          border: '1px solid #e0e0e0',
          borderRadius: 2,
          overflow: 'hidden'
        }}>
          <PollMap votes={allVotes} cities={cities} />
        </Box>
      )}
      
      <VoteList 
        votes={allVotes}
        cities={cities}
        variant="list"
        isJointStatement={isJointStatement}
      />
    </>
  );
}

// Component to display a map of cities that have voted/signed
const PollMap: React.FC<{ votes: Vote[], cities: Record<string, City> }> = ({ votes, cities }) => {
  // Extract city coordinates from votes
  const mapPoints = votes
    .filter(vote => {
      const city = cities[vote.cityId];
      return city && city.lat && city.lon; // Only include cities with coordinates
    })
    .map(vote => {
      const city = cities[vote.cityId];
      return {
        coordinates: [city.lon, city.lat] as [number, number],
        name: city.name,
        id: city.id,
        // Size based on population if available, or default size
        size: city.population ? Math.max(3, city.population / 500000) : 3
      };
    });

  return (
    <Box sx={{ 
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <ComposableMap
        projectionConfig={{ 
          scale: 150,
          center: [10, 40] // Centered on Europe
        }}
        width={800}
        height={300}
        style={{
          width: '100%',
          height: '100%'
        }}
      >
        <Geographies geography={countryBorders}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#F5F4F6"
                stroke="#D6D6DA"
                style={{
                  default: { outline: 'none', fill: '#E4E5E9' },
                  hover: { outline: 'none', fill: '#D6D6DA' },
                  pressed: { outline: 'none' }
                }}
              />
            ))
          }
        </Geographies>
        
        {/* City markers */}
        {mapPoints.map((city, i) => (
          <Marker key={i} coordinates={city.coordinates}>
            <Tooltip 
              title={city.name}
              arrow 
              placement="top"
            >
              <g>
                {/* Larger invisible hit area */}
                <circle
                  r={8}
                  fill="transparent"
                />
                {/* Visible city dot */}
                <circle
                  r={city.size / 2}
                  fill="#1a237e"
                  opacity={0.75}
                  stroke="none"
                  style={{ 
                    pointerEvents: 'none',
                    transition: 'fill 0.2s, opacity 0.2s, r 0.3s',
                  }}
                />
              </g>
            </Tooltip>
          </Marker>
        ))}
      </ComposableMap>
    </Box>
  );
};

export default ResultsSection;
