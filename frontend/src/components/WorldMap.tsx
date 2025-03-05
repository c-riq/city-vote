import React, { useState } from 'react';
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  ZoomableGroup
} from 'react-simple-maps';
import { Box } from '@mui/material';
import countryBorders from './countryBorders.json';

const POPULATION_POINTS = [
  // Europe
  { coordinates: [2.3522, 48.8566], size: 4 },  // Paris
  { coordinates: [-0.1276, 51.5074], size: 4 }, // London
  { coordinates: [13.4050, 52.5200], size: 4 }, // Berlin
  
  // North America
  { coordinates: [-74.0059, 40.7128], size: 5 }, // New York
  { coordinates: [-87.6298, 41.8781], size: 4 }, // Chicago
  { coordinates: [-122.4194, 37.7749], size: 4 }, // San Francisco
  
  // Asia
  { coordinates: [121.4737, 31.2304], size: 6 }, // Shanghai
  { coordinates: [139.6917, 35.6895], size: 6 }, // Tokyo
  { coordinates: [77.2090, 28.6139], size: 5 },  // Delhi
  { coordinates: [116.4074, 39.9042], size: 6 }, // Beijing
  { coordinates: [126.9780, 37.5665], size: 5 }, // Seoul
  { coordinates: [103.8198, 1.3521], size: 4 },  // Singapore
  { coordinates: [120.9842, 14.5995], size: 4 }, // Manila
  
  // South America
  { coordinates: [-46.6333, -23.5505], size: 5 }, // São Paulo
  { coordinates: [-58.3816, -34.6037], size: 4 }, // Buenos Aires
  
  // Africa
  { coordinates: [31.2357, 30.0444], size: 5 },  // Cairo
  { coordinates: [18.4241, -33.9249], size: 4 }, // Cape Town
  { coordinates: [3.3792, 6.5244], size: 5 },    // Lagos
  
  // Oceania
  { coordinates: [151.2093, -33.8688], size: 4 }, // Sydney
  { coordinates: [174.7633, -36.8485], size: 3 }, // Auckland
];

const WorldMap: React.FC = () => {
  const [zoomEnabled, setZoomEnabled] = useState(false);

  return (
    <Box sx={{ 
      width: '100%',
      maxWidth: '800px',
      height: '400px',
      border: '1px solid #ddd',
      borderRadius: 1,
      overflow: 'hidden',
      mb: 4
    }}>
      <ComposableMap
        projectionConfig={{ 
          scale: 120,
          center: [0, 0]
        }}
        width={800}
        height={400}
      >
        {zoomEnabled ? (
          <ZoomableGroup>
            <MapContent />
          </ZoomableGroup>
        ) : (
          <g onClick={() => setZoomEnabled(true)}>
            <MapContent />
          </g>
        )}
      </ComposableMap>
    </Box>
  );
};

const PopulationDots: React.FC = () => (
  <g>
    {POPULATION_POINTS.map(({ coordinates, size }, i) => (
      <circle
        key={i}
        cx={0}
        cy={0}
        r={size / 3}
        fill="#333333"
        opacity={0.5}
        transform={`translate(${coordinates})`}
      />
    ))}
  </g>
);

const MapContent: React.FC = () => (
  <>
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
    <PopulationDots />
  </>
);

export default WorldMap; 