import React, { useState } from 'react';
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  ZoomableGroup,
  Marker
} from 'react-simple-maps';
import { Box } from '@mui/material';
import countryBorders from './countryBorders.json';

const POPULATION_POINTS = [
  // East Asia
  { coordinates: [121.4737, 31.2304], population: 27.8 },    // Shanghai
  { coordinates: [139.6917, 35.6895], population: 37.4 },    // Tokyo
  { coordinates: [116.4074, 39.9042], population: 20.9 },    // Beijing
  { coordinates: [126.9780, 37.5665], population: 25.5 },    // Seoul
  { coordinates: [114.1095, 22.3964], population: 7.6 },     // Hong Kong
  { coordinates: [120.9842, 14.5995], population: 14.4 },    // Manila
  { coordinates: [106.6297, 10.8231], population: 9.3 },     // Ho Chi Minh City
  { coordinates: [100.5018, 13.7563], population: 10.7 },    // Bangkok
  { coordinates: [112.5504, 37.8706], population: 4.3 },     // Taiyuan
  { coordinates: [104.0665, 30.5723], population: 16.3 },    // Chengdu

  // South Asia
  { coordinates: [77.2090, 28.6139], population: 32.9 },     // Delhi
  { coordinates: [72.8777, 19.0760], population: 21.3 },     // Mumbai
  { coordinates: [88.3639, 22.5726], population: 14.9 },     // Kolkata
  { coordinates: [67.0011, 24.8607], population: 16.8 },     // Karachi
  { coordinates: [90.4125, 23.8103], population: 21.7 },     // Dhaka
  { coordinates: [78.4867, 17.3850], population: 10.2 },     // Hyderabad
  { coordinates: [80.2707, 13.0827], population: 11.5 },     // Chennai

  // Southeast Asia
  { coordinates: [106.8456, -6.2088], population: 33.4 },    // Jakarta
  { coordinates: [103.8198, 1.3521], population: 5.7 },      // Singapore
  { coordinates: [96.1733, 16.8661], population: 5.4 },      // Yangon
  
  // Middle East
  { coordinates: [51.3890, 35.6892], population: 9.5 },      // Tehran
  { coordinates: [44.3661, 33.3152], population: 7.5 },      // Baghdad
  { coordinates: [55.2708, 25.2048], population: 3.4 },      // Dubai
  { coordinates: [46.7219, 24.6877], population: 7.6 },      // Riyadh
  
  // Europe
  { coordinates: [37.6173, 55.7558], population: 12.5 },     // Moscow
  { coordinates: [2.3522, 48.8566], population: 11.1 },      // Paris
  { coordinates: [-0.1276, 51.5074], population: 9.4 },      // London
  { coordinates: [13.4050, 52.5200], population: 3.7 },      // Berlin
  { coordinates: [12.4964, 41.9028], population: 4.3 },      // Rome
  { coordinates: [4.9041, 52.3676], population: 2.5 },       // Amsterdam
  { coordinates: [2.1734, 41.3851], population: 5.6 },       // Barcelona
  { coordinates: [21.0122, 52.2297], population: 1.8 },      // Warsaw
  
  // North America
  { coordinates: [-74.0059, 40.7128], population: 18.8 },    // New York
  { coordinates: [-87.6298, 41.8781], population: 9.5 },     // Chicago
  { coordinates: [-118.2437, 34.0522], population: 13.2 },   // Los Angeles
  { coordinates: [-122.4194, 37.7749], population: 4.7 },    // San Francisco
  { coordinates: [-99.1332, 19.4326], population: 22.0 },    // Mexico City
  { coordinates: [-79.3832, 43.6532], population: 6.3 },     // Toronto
  { coordinates: [-73.5673, 45.5017], population: 4.2 },     // Montreal
  
  // South America
  { coordinates: [-46.6333, -23.5505], population: 22.4 },   // São Paulo
  { coordinates: [-58.3816, -34.6037], population: 15.3 },   // Buenos Aires
  { coordinates: [-74.0721, 4.7110], population: 10.7 },     // Bogotá
  { coordinates: [-66.9036, 10.4806], population: 2.9 },     // Caracas
  { coordinates: [-70.6483, -33.4489], population: 6.8 },    // Santiago
  
  // Africa
  { coordinates: [31.2357, 30.0444], population: 20.9 },     // Cairo
  { coordinates: [3.3792, 6.5244], population: 15.4 },       // Lagos
  { coordinates: [36.8219, -1.2921], population: 4.7 },      // Nairobi
  { coordinates: [18.4241, -33.9249], population: 4.8 },     // Cape Town
  { coordinates: [28.0473, -26.2041], population: 5.9 },     // Johannesburg
  { coordinates: [7.4898, 9.0579], population: 3.6 },        // Abuja
  { coordinates: [32.5599, 15.5007], population: 5.8 },      // Khartoum
  
  // Oceania
  { coordinates: [151.2093, -33.8688], population: 5.3 },    // Sydney
  { coordinates: [144.9631, -37.8136], population: 5.0 },    // Melbourne
  { coordinates: [174.7633, -36.8485], population: 1.7 },    // Auckland

  // Additional Cities - Europe
  { coordinates: [18.0686, 59.3293], population: 2.4 },     // Stockholm
  { coordinates: [11.5820, 48.1351], population: 2.9 },     // Munich
  { coordinates: [14.4378, 50.0755], population: 2.7 },     // Prague
  { coordinates: [19.0402, 47.4979], population: 3.1 },     // Budapest
  { coordinates: [23.3219, 42.6977], population: 1.9 },     // Sofia
  { coordinates: [28.9784, 41.0082], population: 15.5 },    // Istanbul
  { coordinates: [4.3517, 50.8503], population: 2.1 },      // Brussels
  { coordinates: [16.3738, 48.2082], population: 2.8 },     // Vienna
  { coordinates: [8.5417, 47.3769], population: 1.8 },      // Zurich
  { coordinates: [-3.7038, 40.4168], population: 3.3 },     // Madrid

  // Additional Cities - Asia
  { coordinates: [113.2644, 23.1291], population: 16.1 },   // Guangzhou
  { coordinates: [108.9402, 34.3416], population: 12.9 },   // Xi'an
  { coordinates: [120.1551, 30.2741], population: 12.2 },   // Hangzhou
  { coordinates: [118.7969, 32.0603], population: 9.8 },    // Nanjing
  { coordinates: [114.2985, 30.5840], population: 11.1 },   // Wuhan
  { coordinates: [117.2264, 39.1077], population: 15.7 },   // Tianjin
  { coordinates: [102.8329, 24.8801], population: 7.2 },    // Kunming
  { coordinates: [91.1710, 29.6500], population: 1.2 },     // Lhasa
  { coordinates: [129.0756, 35.1796], population: 3.4 },    // Busan
  { coordinates: [135.5023, 34.6937], population: 2.7 },    // Osaka

  // Additional Cities - North America
  { coordinates: [-117.1611, 32.7157], population: 3.3 },   // San Diego
  { coordinates: [-95.3698, 29.7604], population: 2.3 },    // Houston
  { coordinates: [-112.0740, 33.4484], population: 4.9 },   // Phoenix
  { coordinates: [-104.9903, 39.7392], population: 2.9 },   // Denver
  { coordinates: [-123.1207, 49.2827], population: 2.5 },   // Vancouver
  { coordinates: [-97.7431, 30.2672], population: 2.2 },    // Austin
  { coordinates: [-80.1918, 25.7617], population: 2.7 },    // Miami
  { coordinates: [-71.0589, 42.3601], population: 4.9 },    // Boston
  { coordinates: [-75.1652, 39.9526], population: 1.6 },    // Philadelphia
  { coordinates: [-83.0458, 42.3314], population: 3.5 },    // Detroit

  // Additional Cities - South/Central America
  { coordinates: [-43.1729, -22.9068], population: 13.5 },  // Rio de Janeiro
  { coordinates: [-78.4678, -0.1807], population: 2.7 },    // Quito
  { coordinates: [-57.3333, -25.2867], population: 2.3 },   // Asunción
  { coordinates: [-84.0879, 9.9281], population: 1.4 },     // San José
  { coordinates: [-90.5069, 14.6349], population: 2.9 },    // Guatemala City
  { coordinates: [-76.2513, -9.9311], population: 2.4 },    // Lima
  { coordinates: [-68.1193, -16.4897], population: 2.3 },   // La Paz
  { coordinates: [-56.1645, -34.9011], population: 1.7 },   // Montevideo
  { coordinates: [-69.8470, 18.4861], population: 3.2 },    // Santo Domingo
  { coordinates: [-79.8772, -2.1900], population: 2.7 },    // Guayaquil

  // Additional Cities - Africa
  { coordinates: [13.2343, -8.8147], population: 2.6 },     // Luanda
  { coordinates: [39.2695, -6.7924], population: 6.4 },     // Dar es Salaam
  { coordinates: [30.0444, -1.9706], population: 1.2 },     // Kigali
  { coordinates: [2.3522, 6.3702], population: 1.7 },       // Porto-Novo
  { coordinates: [-17.3660, 14.7645], population: 3.1 },    // Dakar
  { coordinates: [11.5174, 3.8480], population: 4.1 },      // Yaoundé
  { coordinates: [15.2993, -4.2634], population: 2.4 },     // Brazzaville
  { coordinates: [38.7578, 9.0320], population: 4.8 },      // Addis Ababa
  { coordinates: [45.3182, 2.0469], population: 2.6 },      // Mogadishu
  { coordinates: [29.3639, -3.3822], population: 1.1 },     // Bujumbura

  // Additional Cities - Oceania/Pacific
  { coordinates: [115.8613, -31.9523], population: 2.1 },   // Perth
  { coordinates: [153.0281, -27.4698], population: 2.4 },   // Brisbane
  { coordinates: [172.6362, -43.5320], population: 0.4 },   // Christchurch
].map(city => ({
  ...city,
  size: Math.max(2, city.population / 5) // Ensure minimum size of 2
}));

const WorldMap: React.FC = () => {
  return (
    <Box sx={{ 
      width: '100%',
      maxWidth: '800px',
      height: '400px',
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
        <MapContent />
      </ComposableMap>
    </Box>
  );
};

const PopulationDots: React.FC = () => (
  <>
    {POPULATION_POINTS.map(({ coordinates, size }, i) => (
      <Marker key={i} coordinates={coordinates}>
        <circle
          r={size / 2}
          fill="#333333"
          opacity={0.5}
          stroke="none"
        />
      </Marker>
    ))}
  </>
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