import { Box, Container, Typography, Link as MuiLink } from '@mui/material';

function About() {
  return (
    <Container>
      <Box sx={{ maxWidth: 800, margin: '0 auto', padding: '0 1rem' }}>
        <Box 
          component="section" 
          sx={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '2rem', 
            marginBottom: '2rem', 
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' 
          }}
        >
          <Typography variant="h4" sx={{ color: '#1a237e', marginBottom: '1rem' }}>
            About Us
          </Typography>
          <Typography paragraph>
            Our company Rix Data, based in Amsterdam Netherlands, focuses on enabling more efficient coordination among individuals and governments internationally.
          </Typography>
          <Typography paragraph>
            We are developing three complementary platforms:
          </Typography>
          <Box component="ul" sx={{ margin: '1.5rem 0', paddingLeft: '2rem' }}>
            <Box component="li" sx={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>
              <MuiLink href="https://ip-vote.com" target="_blank" sx={{ color: '#1a237e', textDecoration: 'none', borderBottom: '1px dotted #1a237e', '&:hover': { borderBottom: '1px solid #1a237e' } }}>
                ip-vote.com
              </MuiLink> allows individuals to express their opinion online using their IP Address or Phone number as authentication while keeping a high level of privacy.
            </Box>
            <Box component="li" sx={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>
              <MuiLink href="https://city-vote.com" target="_blank" sx={{ color: '#1a237e', textDecoration: 'none', borderBottom: '1px dotted #1a237e', '&:hover': { borderBottom: '1px solid #1a237e' } }}>
                city-vote.com
              </MuiLink> allows cities to coordinate internationally with minimal effort.
            </Box>
            <Box component="li" sx={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>
              <MuiLink href="https://stated.network" target="_blank" sx={{ color: '#1a237e', textDecoration: 'none', borderBottom: '1px dotted #1a237e', '&:hover': { borderBottom: '1px solid #1a237e' } }}>
                stated.network
              </MuiLink> offers a higher level of security, which would be essential for national governments and foreign ministries to coordinate.
            </Box>
          </Box>
        </Box>

        <Box 
          component="section" 
          sx={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '2rem', 
            marginBottom: '2rem', 
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' 
          }}
        >
          <Typography variant="h4" sx={{ color: '#1a237e', marginBottom: '1rem' }}>
            Our Mission
          </Typography>
          <Typography paragraph>
            Our mission is to strengthen democracies and international law enforcement through efficient coordination among governments.
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
            <Box 
              component="img" 
              src="/img/founder_C.png" 
              alt="Chris Rieckmann" 
              sx={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '40px', 
                marginRight: '1.5rem', 
                objectFit: 'cover' 
              }} 
            />
            <Box>
              <Typography variant="h6" sx={{ marginBottom: '0.3rem', color: '#333', fontSize: '1.2rem' }}>
                Chris Rieckmann
              </Typography>
              <Typography sx={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Founder & CEO
              </Typography>
              <MuiLink 
                href="https://www.linkedin.com/in/c-rieckmann/" 
                target="_blank" 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  fontSize: '0.9rem',
                  color: '#1a237e', 
                  textDecoration: 'none', 
                  borderBottom: '1px dotted #1a237e', 
                  '&:hover': { borderBottom: '1px solid #1a237e' } 
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#0077B5" style={{ marginRight: '0.5rem' }}>
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                LinkedIn Profile
              </MuiLink>
            </Box>
          </Box>
        </Box>

        <Box 
          component="section" 
          sx={{ 
            background: 'linear-gradient(to bottom right, #ffffff, #f8f9fa)', 
            borderRadius: '12px', 
            padding: '2rem', 
            marginBottom: '2rem', 
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' 
          }}
        >
          <Typography variant="h4" sx={{ color: '#1a237e', marginBottom: '1rem' }}>
            Authentication Process
          </Typography>
          <Box sx={{ backgroundColor: '#e8eaf6', borderRadius: '8px', padding: '1.5rem', margin: '1rem 0' }}>
            <Typography paragraph>
              While our current authentication approach is simplified, we recognize its limitations for real-world implementation and are continuously improving it.
            </Typography>
          </Box>
          <Typography paragraph>
            Instead of relying on centralized identity verification through single entities like LinkedIn or Twitter, we envision a transition towards independently verifiable authentication and decentralized city-to-city verification systems.
          </Typography>
          <Typography paragraph>
            We've adopted a two-phase approach:
          </Typography>
          <Box component="ol" sx={{ margin: '1.5rem 0', paddingLeft: '2rem' }}>
            <Box component="li" sx={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>
              Phase 1: A simplified authentication system that allows cities to quickly explore the platform's possibilities with minimal effort
            </Box>
            <Box component="li" sx={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>
              Phase 2: A gradual transition to more robust, decentralized solutions as cities commit to deeper participation
            </Box>
          </Box>
          <Typography paragraph>
            For a comprehensive outline of a more secure verification and authentication approach, please visit{' '}
            <MuiLink 
              href="https://stated.network" 
              target="_blank" 
              sx={{ 
                color: '#1a237e', 
                textDecoration: 'none', 
                borderBottom: '1px dotted #1a237e', 
                '&:hover': { borderBottom: '1px solid #1a237e' } 
              }}
            >
              stated.network
            </MuiLink>.
          </Typography>
        </Box>
      </Box>

      <Box 
        component="footer" 
        sx={{ 
          textAlign: 'center', 
          padding: '2rem 1rem', 
          color: '#666', 
          fontSize: '0.9rem' 
        }}
      >
        <Typography variant="body2">
          © 2024 Rix Data NL B.V. · Herengracht 551, 1017 BW Amsterdam · KVK 88818306
        </Typography>
      </Box>
    </Container>
  );
}

export default About;
