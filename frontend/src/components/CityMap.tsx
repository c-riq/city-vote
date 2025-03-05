import React, { useState } from 'react';
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  ZoomableGroup,
  Marker
} from 'react-simple-maps';
import { Box, Typography } from '@mui/material';
import countryBorders from './countryBorders.json';

interface CityInfo {
  name: string;
  id: string;
  lat: number;
  lon: number;
  country: string;
  population: number;
}

interface CityMapProps {
  cities: Record<string, CityInfo>;
  currentCity?: CityInfo;
}

const CityMap: React.FC<CityMapProps> = ({ cities, currentCity }) => {
  const [zoomEnabled, setZoomEnabled] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityInfo | null>(null);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Registered Cities
      </Typography>

      {/* Info display */}
      <Box sx={{ 
        height: '60px', 
        border: '1px solid #ddd',
        borderRadius: 1,
        p: 2,
        mb: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {selectedCity ? (
          <Typography>
            {selectedCity.name} ({selectedCity.id})
          </Typography>
        ) : (
          <Typography color="text.secondary">
            Hover over a city to see details
          </Typography>
        )}
      </Box>

      {/* Map container */}
      <Box sx={{ 
        width: '100%', 
        height: {
          xs: '300px',
          sm: '340px',
          md: '380px'
        },
        border: '1px solid #ddd',
        borderRadius: 1,
        overflow: 'hidden'
      }}>
        <ComposableMap 
          projectionConfig={{ scale: 130 }}
          height={350}
        >
          {zoomEnabled ? (
            <ZoomableGroup>
              <MapContent 
                cities={cities}
                setSelectedCity={setSelectedCity}
                currentCity={currentCity}
              />
            </ZoomableGroup>
          ) : (
            <g onClick={() => setZoomEnabled(true)}>
              <MapContent 
                cities={cities}
                setSelectedCity={setSelectedCity}
                currentCity={currentCity}
              />
            </g>
          )}
        </ComposableMap>
      </Box>

      {!zoomEnabled && (
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
          Click the map to enable zoom and pan
        </Typography>
      )}
    </Box>
  );
};

interface MapContentProps {
  cities: Record<string, CityInfo>;
  setSelectedCity: (city: CityInfo | null) => void;
  currentCity?: CityInfo;
}

const MapContent: React.FC<MapContentProps> = ({  
  setSelectedCity, 
  currentCity 
}) => (
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
              default: { outline: 'none' },
              hover: { outline: 'none' },
              pressed: { outline: 'none' }
            }}
          />
        ))
      }
    </Geographies>
    
    {currentCity && currentCity.lon && currentCity.lat && (
      <Marker 
        key={currentCity.id}
        coordinates={[currentCity.lon, currentCity.lat]}
        onMouseEnter={() => setSelectedCity(currentCity)}
        onMouseLeave={() => setSelectedCity(null)}
      >
        <circle
          r={6}
          fill="#FF5533"
          stroke="#FFFFFF"
          strokeWidth={2}
        />
      </Marker>
    )}
  </>
);

export default CityMap; 