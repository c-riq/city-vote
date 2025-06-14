import { Box, Typography, Divider, CircularProgress, Skeleton } from '@mui/material';
import VoteList from '../VoteList';
import { City, VoteAuthor } from '../../backendTypes';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Tooltip } from '@mui/material';
import countryBorders from '../countryBorders.json';
import { countries } from '../../countries';

// Use the types from backendTypes.ts
interface Vote {
  cityId: string;
  timestamp: number;
  option: string;
  city?: string;
  voteInfo: VoteAuthor & {
    externalVerificationSource?: string;
    cityAssociation?: {
      title: string;
      confidence: number;
      identityVerifiedBy: string;
      verificationTime: string;
    };
  };
}

interface ResultsSectionProps {
  votesByOption: Record<string, number>;
  allVotes: Vote[];
  cities: Record<string, City>;
  isJointStatement: boolean;
  isLoadingVotes?: boolean;
}

function ResultsSection({ votesByOption, allVotes, cities, isJointStatement, isLoadingVotes = false }: ResultsSectionProps) {
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
        
        {isLoadingVotes ? (
          <Box sx={{
            width: '100%',
            maxWidth: 400,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}>
            <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 2 }} />
          </Box>
        ) : Object.entries(votesByOption).length > 0 ? (
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
      
      {isLoadingVotes ? (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          py: 4
        }}>
          <CircularProgress size={40} />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Loading {isJointStatement ? 'signatures' : 'votes'}...
          </Typography>
          
          <Skeleton
            variant="rectangular"
            width="100%"
            height={300}
            sx={{ borderRadius: 2, mb: 2 }}
          />
          
          <Box sx={{ width: '100%' }}>
            {[...Array(3)].map((_, index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
              </Box>
            ))}
          </Box>
        </Box>
      ) : (
        <>
          {allVotes.length > 0 && (
            <Box sx={{
              width: '100%',
              aspectRatio: '800/500', // 8:5 ratio to match the map dimensions
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
            variant="compact"
            isJointStatement={isJointStatement}
            isLoading={isLoadingVotes}
          />
        </>
      )}
    </>
  );
}

// Component to display a map of cities that have voted/signed
const PollMap: React.FC<{ votes: Vote[], cities: Record<string, City> }> = ({ votes, cities }) => {
  // Extract city coordinates from votes and calculate country population representation
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
        country: city.country,
        population: city.population || 0,
        // Size based on population if available, or default size
        size: city.population ? Math.max(3, Math.log(city.population / 100000 + 1) * 2) : 3
      };
    });
    
  // Calculate population representation by country
  const countryPopulationData: Record<string, { 
    representedPopulation: number, 
    countryPopulation: number,
    fraction: number,
    wikidataId: string
  }> = {};
  
  // Helper function to find country data by name or code
  const findCountryData = (countryName: string, countryCode?: string) => {
    return countries.countries.find(country => {
      // Try to match by name
      if (typeof country[0] === 'string' && typeof countryName === 'string' &&
          (country[0] === countryName || 
           countryName.includes(country[0]) || 
           country[0].includes(countryName))) {
        return true;
      }
      
      // Try to match by country code if provided
      if (countryCode && country[1] === countryCode) {
        return true;
      }
      
      return false;
    });
  };

  // First, collect all represented population by country
  mapPoints.forEach(city => {
    if (!city.country || !city.population) return;
    
    const countryData = findCountryData(city.country);
    if (!countryData) return;
    
    const countryWikidataId = countryData[4] as string;
    if (!countryWikidataId) return;
    
    if (!countryPopulationData[countryWikidataId]) {
      countryPopulationData[countryWikidataId] = {
        representedPopulation: 0,
        countryPopulation: 0,
        fraction: 0,
        wikidataId: countryWikidataId
      };
    }
    
    countryPopulationData[countryWikidataId].representedPopulation += city.population;
  });
  
  const countryData = countries.countries;
  
  countryData.forEach(country => {
    const population = country[5] ? Number(country[5]) : null;
    const wikidataId = country[4] as string;
    
    if (wikidataId && population && countryPopulationData[wikidataId]) {
      countryPopulationData[wikidataId].countryPopulation = population;
      // Calculate the fraction of population represented
      const represented = countryPopulationData[wikidataId].representedPopulation;
      countryPopulationData[wikidataId].fraction = represented / population;
    }
  });
  
  // No need to log country data
  
  // Color scale mapping for population representation - more subtle colors
  const getColorForFraction = (fraction: number): string => {
  const colorScale = [
    { threshold: 0, color: "#F5F5F5" },          // Very light gray - 0%
    { threshold: 0.0001, color: "#F0F8FF" },     // Alice Blue - 0.01%
    { threshold: 0.001, color: "#E6F2FF" },      // Very light blue - 0.1%
    { threshold: 0.01, color: "#DCE9FC" },       // Lighter blue - 1%
    { threshold: 0.05, color: "#D2E0F9" },       // Light blue - 5%
    { threshold: 0.1, color: "#C7D8F6" },        // Subtle blue - 10%
    { threshold: 0.15, color: "#BDCFF3" },       // Soft blue - 15%
    { threshold: 0.2, color: "#B3C6F0" },        // Muted blue - 20%
    { threshold: 0.25, color: "#A9BDED" },       // Pastel blue - 25%
    { threshold: 0.3, color: "#9FB4EA" },        // Gentle blue - 30%
    { threshold: Infinity, color: "#95ABE7" }    // Subtle medium blue - >30%
    ];
    
    for (let i = 0; i < colorScale.length - 1; i++) {
      if (fraction < colorScale[i + 1].threshold) {
        return colorScale[i].color;
      }
    }
    
    return colorScale[colorScale.length - 1].color;
  };

  // Function to get color based on population fraction
  const getCountryColor = (geo: { properties: { name: string; iso_a2: string } }) => {
    const countryName = geo.properties.name;
    const countryCode = geo.properties.iso_a2;
    
    const countryData = findCountryData(countryName, countryCode);
    
    if (!countryData) {
      return "#F5F5F5"; // Default color if country not found - very light gray
    }
    
    const wikidataId = countryData[4] as string;
    if (!wikidataId || !countryPopulationData[wikidataId]) {
      return "#F5F5F5"; // Default color if no population data - very light gray
    }
    
    const fraction = countryPopulationData[wikidataId].fraction || 0;
    return getColorForFraction(fraction);
  };

  // Optimized world map - reduce polar padding and show Australia better
  const projection = {
    scale: 200, // Larger scale to reduce polar padding on both ends
    center: [15, 5] as [number, number] // Shift east to show Australia better, slightly south for polar padding
  };

  return (
    <Box sx={{ 
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <ComposableMap
        projectionConfig={projection}
        width={800}
        height={500}
        style={{
          width: '100%',
          height: '100%'
        }}
      >
        <Geographies geography={countryBorders}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const countryColor = getCountryColor(geo);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={countryColor}
                  stroke="#D6D6DA"
                  style={{
                    default: { outline: 'none', fill: countryColor },
                    hover: { outline: 'none', fill: countryColor, opacity: 0.8 },
                    pressed: { outline: 'none' }
                  }}
                />
              );
            })
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
