import React from 'react';
import { 
  ComposableMap, 
  Geographies, 
  Geography, 
  Marker
} from 'react-simple-maps';
import { Box, Tooltip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import countryBorders from './countryBorders.json';

export const POPULATION_POINTS = [
  // East Asia
  { coordinates: [121.4737, 31.2304], population: 27.8, name: "Shanghai", wikidataId: "Q8686" },
  { coordinates: [139.6917, 35.6895], population: 37.4, name: "Tokyo", wikidataId: "Q1490" },
  { coordinates: [116.4074, 39.9042], population: 20.9, name: "Beijing", wikidataId: "Q956" },
  { coordinates: [126.9780, 37.5665], population: 25.5, name: "Seoul", wikidataId: "Q8684" },
  { coordinates: [114.1095, 22.3964], population: 7.6, name: "Hong Kong", wikidataId: "Q8646" },
  { coordinates: [120.9842, 14.5995], population: 14.4, name: "Manila", wikidataId: "Q1461" },
  { coordinates: [106.6297, 10.8231], population: 9.3, name: "Ho Chi Minh City", wikidataId: "Q1854" },
  { coordinates: [100.5018, 13.7563], population: 10.7, name: "Bangkok", wikidataId: "Q1861" },
  { coordinates: [112.5504, 37.8706], population: 4.3, name: "Taiyuan", wikidataId: "Q72778" },
  { coordinates: [104.0665, 30.5723], population: 16.3, name: "Chengdu", wikidataId: "Q30002" },

  // South Asia
  { coordinates: [77.2090, 28.6139], population: 32.9, name: "Delhi", wikidataId: "Q1353" },
  { coordinates: [72.8777, 19.0760], population: 21.3, name: "Mumbai", wikidataId: "Q1156" },
  { coordinates: [88.3639, 22.5726], population: 14.9, name: "Kolkata", wikidataId: "Q1348" },
  { coordinates: [67.0011, 24.8607], population: 16.8, name: "Karachi", wikidataId: "Q8660" },
  { coordinates: [90.4125, 23.8103], population: 21.7, name: "Dhaka", wikidataId: "Q1354" },
  { coordinates: [78.4867, 17.3850], population: 10.2, name: "Hyderabad", wikidataId: "Q1361" },
  { coordinates: [80.2707, 13.0827], population: 11.5, name: "Chennai", wikidataId: "Q1352" },

  // Southeast Asia
  { coordinates: [106.8456, -6.2088], population: 33.4, name: "Jakarta", wikidataId: "Q3630" },
  { coordinates: [103.8198, 1.3521], population: 5.7, name: "Singapore", wikidataId: "Q334" },
  { coordinates: [96.1733, 16.8661], population: 5.4, name: "Yangon", wikidataId: "Q37995" },
  
  // Middle East
  { coordinates: [51.3890, 35.6892], population: 9.5, name: "Tehran", wikidataId: "Q3616" },
  { coordinates: [44.3661, 33.3152], population: 7.5, name: "Baghdad", wikidataId: "Q1530" },
  { coordinates: [55.2708, 25.2048], population: 3.4, name: "Dubai", wikidataId: "Q612" },
  { coordinates: [46.7219, 24.6877], population: 7.6, name: "Riyadh", wikidataId: "Q3692" },
  
  // Europe
  { coordinates: [37.6173, 55.7558], population: 12.5, name: "Moscow", wikidataId: "Q649" },
  { coordinates: [2.3522, 48.8566], population: 11.1, name: "Paris", wikidataId: "Q90" },
  { coordinates: [-0.1276, 51.5074], population: 9.4, name: "London", wikidataId: "Q84" },
  { coordinates: [13.4050, 52.5200], population: 3.7, name: "Berlin", wikidataId: "Q64" },
  { coordinates: [12.4964, 41.9028], population: 4.3, name: "Rome", wikidataId: "Q220" },
  { coordinates: [4.9041, 52.3676], population: 2.5, name: "Amsterdam", wikidataId: "Q727" },
  { coordinates: [2.1734, 41.3851], population: 5.6, name: "Barcelona", wikidataId: "Q1492" },
  { coordinates: [21.0122, 52.2297], population: 1.8, name: "Warsaw", wikidataId: "Q270" },
  
  // North America
  { coordinates: [-74.0059, 40.7128], population: 18.8, name: "New York", wikidataId: "Q60" },
  { coordinates: [-87.6298, 41.8781], population: 9.5, name: "Chicago", wikidataId: "Q1297" },
  { coordinates: [-118.2437, 34.0522], population: 13.2, name: "Los Angeles", wikidataId: "Q65" },
  { coordinates: [-122.4194, 37.7749], population: 4.7, name: "San Francisco", wikidataId: "Q62" },
  { coordinates: [-99.1332, 19.4326], population: 22.0, name: "Mexico City", wikidataId: "Q1489" },
  { coordinates: [-79.3832, 43.6532], population: 6.3, name: "Toronto", wikidataId: "Q172" },
  { coordinates: [-73.5673, 45.5017], population: 4.2, name: "Montreal", wikidataId: "Q340" },
  
  // South America
  { coordinates: [-46.6333, -23.5505], population: 22.4, name: "São Paulo", wikidataId: "Q174" },
  { coordinates: [-58.3816, -34.6037], population: 15.3, name: "Buenos Aires", wikidataId: "Q1486" },
  { coordinates: [-74.0721, 4.7110], population: 10.7, name: "Bogotá", wikidataId: "Q2841" },
  { coordinates: [-66.9036, 10.4806], population: 2.9, name: "Caracas", wikidataId: "Q1533" },
  { coordinates: [-70.6483, -33.4489], population: 6.8, name: "Santiago", wikidataId: "Q2887" },
  
  // Africa
  { coordinates: [31.2357, 30.0444], population: 20.9, name: "Cairo", wikidataId: "Q85" },
  { coordinates: [3.3792, 6.5244], population: 15.4, name: "Lagos", wikidataId: "Q8673" },
  { coordinates: [36.8219, -1.2921], population: 4.7, name: "Nairobi", wikidataId: "Q3870" },
  { coordinates: [18.4241, -33.9249], population: 4.8, name: "Cape Town", wikidataId: "Q5465" },
  { coordinates: [28.0473, -26.2041], population: 5.9, name: "Johannesburg", wikidataId: "Q34647" },
  { coordinates: [7.4898, 9.0579], population: 3.6, name: "Abuja", wikidataId: "Q3787" },
  { coordinates: [32.5599, 15.5007], population: 5.8, name: "Khartoum", wikidataId: "Q1963" },
  
  // Oceania
  { coordinates: [151.2093, -33.8688], population: 5.3, name: "Sydney", wikidataId: "Q3130" },
  { coordinates: [144.9631, -37.8136], population: 5.0, name: "Melbourne", wikidataId: "Q3141" },
  { coordinates: [174.7633, -36.8485], population: 1.7, name: "Auckland", wikidataId: "Q37100" },

  // Additional Cities - Europe
  { coordinates: [18.0686, 59.3293], population: 2.4, name: "Stockholm", wikidataId: "Q1754" },
  { coordinates: [11.5820, 48.1351], population: 2.9, name: "Munich", wikidataId: "Q1726" },
  { coordinates: [14.4378, 50.0755], population: 2.7, name: "Prague", wikidataId: "Q1085" },
  { coordinates: [19.0402, 47.4979], population: 3.1, name: "Budapest", wikidataId: "Q1781" },
  { coordinates: [23.3219, 42.6977], population: 1.9, name: "Sofia", wikidataId: "Q472" },
  { coordinates: [28.9784, 41.0082], population: 15.5, name: "Istanbul", wikidataId: "Q406" },
  { coordinates: [4.3517, 50.8503], population: 2.1, name: "Brussels", wikidataId: "Q239" },
  { coordinates: [16.3738, 48.2082], population: 2.8, name: "Vienna", wikidataId: "Q1741" },
  { coordinates: [8.5417, 47.3769], population: 1.8, name: "Zurich", wikidataId: "Q72" },
  { coordinates: [-3.7038, 40.4168], population: 3.3, name: "Madrid", wikidataId: "Q2807" },

  // Additional Cities - Asia
  { coordinates: [113.2644, 23.1291], population: 16.1, name: "Guangzhou", wikidataId: "Q16572" },
  { coordinates: [108.9402, 34.3416], population: 12.9, name: "Xi'an", wikidataId: "Q5826" },
  { coordinates: [120.1551, 30.2741], population: 12.2, name: "Hangzhou", wikidataId: "Q4970" },
  { coordinates: [118.7969, 32.0603], population: 9.8, name: "Nanjing", wikidataId: "Q16666" },
  { coordinates: [114.2985, 30.5840], population: 11.1, name: "Wuhan", wikidataId: "Q11746" },
  { coordinates: [117.2264, 39.1077], population: 15.7, name: "Tianjin", wikidataId: "Q11736" },
  { coordinates: [102.8329, 24.8801], population: 7.2, name: "Kunming", wikidataId: "Q182852" },
  { coordinates: [91.1710, 29.6500], population: 1.2, name: "Lhasa", wikidataId: "Q5869" },
  { coordinates: [129.0756, 35.1796], population: 3.4, name: "Busan", wikidataId: "Q16520" },
  { coordinates: [135.5023, 34.6937], population: 2.7, name: "Osaka", wikidataId: "Q35765" },

  // Additional Cities - North America
  { coordinates: [-117.1611, 32.7157], population: 3.3, name: "San Diego", wikidataId: "Q16552" },
  { coordinates: [-95.3698, 29.7604], population: 2.3, name: "Houston", wikidataId: "Q16555" },
  { coordinates: [-112.0740, 33.4484], population: 4.9, name: "Phoenix", wikidataId: "Q16556" },
  { coordinates: [-104.9903, 39.7392], population: 2.9, name: "Denver", wikidataId: "Q16554" },
  { coordinates: [-123.1207, 49.2827], population: 2.5, name: "Vancouver", wikidataId: "Q24639" },
  { coordinates: [-97.7431, 30.2672], population: 2.2, name: "Austin", wikidataId: "Q16559" },
  { coordinates: [-80.1918, 25.7617], population: 2.7, name: "Miami", wikidataId: "Q8652" },
  { coordinates: [-71.0589, 42.3601], population: 4.9, name: "Boston", wikidataId: "Q100" },
  { coordinates: [-75.1652, 39.9526], population: 1.6, name: "Philadelphia", wikidataId: "Q1345" },
  { coordinates: [-83.0458, 42.3314], population: 3.5, name: "Detroit", wikidataId: "Q12439" },

  // Additional Cities - South/Central America
  { coordinates: [-43.1729, -22.9068], population: 13.5, name: "Rio de Janeiro", wikidataId: "Q8678" },
  { coordinates: [-78.4678, -0.1807], population: 2.7, name: "Quito", wikidataId: "Q2900" },
  { coordinates: [-57.3333, -25.2867], population: 2.3, name: "Asunción", wikidataId: "Q2933" },
  { coordinates: [-84.0879, 9.9281], population: 1.4, name: "San José", wikidataId: "Q3070" },
  { coordinates: [-90.5069, 14.6349], population: 2.9, name: "Guatemala City", wikidataId: "Q1555" },
  { coordinates: [-76.2513, -9.9311], population: 2.4, name: "Lima", wikidataId: "Q2868" },
  { coordinates: [-68.1193, -16.4897], population: 2.3, name: "La Paz", wikidataId: "Q1491" },
  { coordinates: [-56.1645, -34.9011], population: 1.7, name: "Montevideo", wikidataId: "Q1335" },
  { coordinates: [-69.8470, 18.4861], population: 3.2, name: "Santo Domingo", wikidataId: "Q34820" },
  { coordinates: [-79.8772, -2.1900], population: 2.7, name: "Guayaquil", wikidataId: "Q43509" },

  // Additional Cities - Africa
  { coordinates: [13.2343, -8.8147], population: 2.6, name: "Luanda", wikidataId: "Q3897" },
  { coordinates: [39.2695, -6.7924], population: 6.4, name: "Dar es Salaam", wikidataId: "Q1960" },
  { coordinates: [30.0444, -1.9706], population: 1.2, name: "Kigali", wikidataId: "Q3859" },
  { coordinates: [2.3522, 6.3702], population: 1.7, name: "Porto-Novo", wikidataId: "Q3799" },
  { coordinates: [-17.3660, 14.7645], population: 3.1, name: "Dakar", wikidataId: "Q3718" },
  { coordinates: [11.5174, 3.8480], population: 4.1, name: "Yaoundé", wikidataId: "Q3808" },
  { coordinates: [15.2993, -4.2634], population: 2.4, name: "Brazzaville", wikidataId: "Q3844" },
  { coordinates: [38.7578, 9.0320], population: 4.8, name: "Addis Ababa", wikidataId: "Q3624" },
  { coordinates: [45.3182, 2.0469], population: 2.6, name: "Mogadishu", wikidataId: "Q2449" },
  { coordinates: [29.3639, -3.3822], population: 1.1, name: "Bujumbura", wikidataId: "Q3854" },

  // Additional Cities - Oceania/Pacific
  { coordinates: [115.8613, -31.9523], population: 2.1, name: "Perth", wikidataId: "Q3183" },
  { coordinates: [153.0281, -27.4698], population: 2.4, name: "Brisbane", wikidataId: "Q34932" },
  { coordinates: [172.6362, -43.5320], population: 0.4, name: "Christchurch", wikidataId: "Q79990" },
].map(city => ({
  ...city,
  size: Math.max(3, city.population / 5) // Ensure minimum size of 3 (was 2)
}));

const WorldMap: React.FC = () => {
  return (
    <Box sx={{ 
      width: '100%',
      maxWidth: '800px',
      height: '100%',
      overflow: 'hidden',
      mb: 4
    }}>
      <ComposableMap
        projectionConfig={{ 
          scale: 140,
          center: [20, 20]
        }}
        width={800}
        height={400}
        style={{
          width: '100%',
          height: 'auto'
        }}
      >
        <MapContent />
      </ComposableMap>
    </Box>
  );
};

const PopulationDots: React.FC = () => {
  const navigate = useNavigate();

  const handleCityClick = (city: typeof POPULATION_POINTS[0]) => {
    if (city.wikidataId) {
      navigate(`/city/${city.wikidataId}`);
    } else {
      navigate(`/city/${city.name}`);
    }
  };

  return (
    <>
      {POPULATION_POINTS.map(({ coordinates, size, name }, i) => (
        <Marker key={i} coordinates={coordinates as [number, number]}>
          <Tooltip title={name || `City ${i + 1}`} arrow placement="top">
            <g>
              {/* Invisible larger hit area */}
              <circle
                r={Math.max(8, size * 1.5)}  // Even larger invisible hit area (minimum 8px, 1.5x size)
                fill="transparent"
                style={{ cursor: name ? 'pointer' : 'default' }}
                onClick={() => name && handleCityClick(POPULATION_POINTS[i])}
                onMouseEnter={(e) => {
                  if (name) {
                    // Find the visible circle (next sibling) and modify it
                    const visibleCircle = e.currentTarget.nextSibling as SVGCircleElement;
                    if (visibleCircle) {
                      visibleCircle.style.fill = '#3949ab';
                      visibleCircle.style.opacity = '0.9';
                      // Enlarge small dots more dramatically (double their size)
                      const enlargeFactor = size <= 3 ? 2 : 1.5;
                      visibleCircle.setAttribute('r', (size * 0.5 * enlargeFactor).toString());
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  // Find the visible circle (next sibling) and restore it
                  const visibleCircle = e.currentTarget.nextSibling as SVGCircleElement;
                  if (visibleCircle) {
                    visibleCircle.style.fill = '#1a237e';
                    visibleCircle.style.opacity = '0.75';
                    visibleCircle.setAttribute('r', (size * 0.5).toString());
                  }
                }}
              />
              {/* Visible city dot */}
              <circle
                r={size / 2}
                fill="#1a237e"  // Primary color
                opacity={0.75}
                stroke="none"   // Remove border
                style={{ 
                  pointerEvents: 'none',  // Let the hit area handle events
                  transition: 'fill 0.2s, opacity 0.2s, r 0.3s'
                }}
              />
            </g>
          </Tooltip>
        </Marker>
      ))}
    </>
  );
};

const MapContent: React.FC = () => {
  return (
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
};

export default WorldMap;
