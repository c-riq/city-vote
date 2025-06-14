import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { PERSONAL_AUTH_API_HOST } from '../constants';
import { AuthUserProfile } from '../backendTypes';

interface UsersProps {}

interface UserWithDetails extends AuthUserProfile {
  email: string;
}

const Users: React.FC<UsersProps> = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Check if user is admin based on stored admin status
  const isAdmin = () => {
    const adminStatus = localStorage.getItem('userIsAdmin');
    return adminStatus === 'true';
  };

  useEffect(() => {
    if (!isAdmin()) {
      setError('Access denied. Administrator privileges required.');
      setIsLoading(false);
      return;
    }
    
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const sessionToken = localStorage.getItem('userSessionToken');
      const userEmail = localStorage.getItem('userEmail');
      
      if (!sessionToken || !userEmail) {
        setError('Authentication required. Please log in.');
        return;
      }

      const response = await fetch(`${PERSONAL_AUTH_API_HOST}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          action: 'getAllUsers',
          email: userEmail,
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch users');
      }

      setUsers(data.users || []);
      setError(''); // Clear any previous errors
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!isAdmin()) {
    return (
      <Box sx={{ py: 4, px: 2, mt: 10 }}>
        <Paper elevation={3} sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
          <Alert severity="error">
            Access denied. Administrator privileges required to view this page.
          </Alert>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 4, px: 2, mt: 10 }}>
      <Paper elevation={3} sx={{ p: 4, mx: 'auto' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          User Management
        </Typography>
        <Typography variant="body1" paragraph color="text.secondary">
          Manage users and verify their city associations
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>User ID</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Email Verified</TableCell>
                  <TableCell>City Associations</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">
                        No users found or API not implemented yet
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow
                      key={user.userId}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/users/${user.userId}`)}
                    >
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {user.userId.substring(0, 8)}...
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.emailVerified ? 'Verified' : 'Pending'}
                          color={user.emailVerified ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {user.cityAssociations?.length || 0} cities
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View user details">
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/users/${user.userId}`);
                            }}
                            size="small"
                          >
                            <span className="material-icons">person</span>
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

      </Paper>
    </Box>
  );
};

export default Users;