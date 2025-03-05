import React, { useState } from 'react';
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  ZoomableGroup
} from 'react-simple-maps';
import { Box } from '@mui/material';
import countryBorders from './countryBorders.json';

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

const MapContent: React.FC = () => (
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
);

export default WorldMap; 