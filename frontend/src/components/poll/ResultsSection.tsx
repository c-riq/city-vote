import { Box, Typography, Divider } from '@mui/material';
import VoteList from '../VoteList';
import { City, VoteAuthor } from '../../backendTypes';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Tooltip } from '@mui/material';
import countryBorders from '../countryBorders.json';
import { countries } from '../../countries';

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
        size: city.population ? Math.max(3, city.population / 500000) : 3
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
  
  // Calculate country population representation without logging
  
  // Then, get total country populations from the countries data
  const countryData = countries.countries;
  
  // Add country population data directly using Wikidata IDs
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
      { threshold: 0.0005, color: "#E6F2FF" },     // Very light blue - 0.05%
      { threshold: 0.001, color: "#DCE9FC" },      // Lighter blue - 0.1%
      { threshold: 0.005, color: "#D2E0F9" },      // Light blue - 0.5%
      { threshold: 0.01, color: "#C7D8F6" },       // Subtle blue - 1%
      { threshold: 0.05, color: "#BDCFF3" },       // Soft blue - 5%
      { threshold: 0.1, color: "#B3C6F0" },        // Muted blue - 10%
      { threshold: 0.2, color: "#A9BDED" },        // Pastel blue - 20%
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

  // Calculate map bounds based on city coordinates
  const calculateMapProjection = () => {
    // Default values centered on Europe if no cities with coordinates
    if (mapPoints.length === 0) {
      return {
        scale: 150,
        center: [10, 40] as [number, number]
      };
    }

    // Find min/max coordinates to determine the bounding box
    let minLon = Infinity;
    let maxLon = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    mapPoints.forEach(point => {
      const [lon, lat] = point.coordinates;
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });

    // Calculate center point
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;

    // Calculate appropriate scale based on the spread of coordinates
    // The wider the spread, the smaller the scale (more zoomed out)
    const lonSpread = Math.abs(maxLon - minLon);
    const latSpread = Math.abs(maxLat - minLat);
    
    // Base scale on the larger of the two spreads
    // Add padding to ensure all points are visible
    const maxSpread = Math.max(lonSpread, latSpread);
    
    // Scale calculation - adjust these values based on testing
    // Smaller spread = larger scale (more zoomed in)
    let scale = 1200; // Higher default scale for more zoom
    
    if (maxSpread > 0) {
      // Inverse relationship between spread and scale
      // Adjusted formula to provide more zoom (higher scale values)
      scale = Math.min(1200, Math.max(300, 400 / maxSpread));
    }
    
    // If we have only one point or points very close together, zoom in more
    if (maxSpread < 1) {
      scale = 1200;
    }
    
    // Add padding to the bounding box by adjusting the center slightly
    // This helps ensure all points are visible with some margin
    const padding = maxSpread * 0.1; // 10% padding
    minLon -= padding;
    maxLon += padding;
    minLat -= padding;
    maxLat += padding;

    return {
      scale,
      center: [centerLon, centerLat] as [number, number]
    };
  };

  const projection = calculateMapProjection();

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
        height={300}
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
