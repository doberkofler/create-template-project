import React from 'react';
import {Container, Typography, Button, Paper, Box} from '@mui/material';
import {useAuth} from '../contexts/AuthContext.js';
import {useNavigate} from 'react-router-dom';

export const Dashboard = () => {
	const {user, logout} = useAuth();
	const navigate = useNavigate();

	const handleLogout = () => {
		logout();
		navigate('/login');
	};

	return (
		<Container maxWidth="md">
			<Box mt={4}>
				<Paper elevation={3}>
					<Box p={4}>
						<Typography variant="h4" gutterBottom>
							Dashboard
						</Typography>
						<Typography variant="h6">Welcome, {user?.name}!</Typography>
						<Typography variant="body1" color="textSecondary" gutterBottom>
							Email: {user?.email}
						</Typography>
						<Box mt={4}>
							<Typography variant="body2" gutterBottom>
								This is a protected page. You can only see this because you are logged in.
							</Typography>
							<Button variant="outlined" color="primary" onClick={handleLogout}>
								Logout
							</Button>
						</Box>
					</Box>
				</Paper>
			</Box>
		</Container>
	);
};
