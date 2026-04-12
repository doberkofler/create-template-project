/* eslint-disable react/jsx-max-depth */
/* eslint-disable import/no-relative-parent-imports */
/* eslint-disable eslint/no-void */
/* eslint-disable oxc/no-optional-chaining */
import {Container, Typography, Button, Paper, Box} from '@mui/material';
import {type ReactNode} from 'react';
import {useAuth} from '../contexts/AuthContext.js';
import {useNavigate} from 'react-router-dom';

export const Dashboard = (): ReactNode => {
	const {user, logout} = useAuth();
	const navigate = useNavigate();

	const handleLogout = (): void => {
		logout();
		void navigate('/login');
	};

	return (
		<Container maxWidth="md">
			<Box sx={{mt: 4}}>
				<Paper elevation={3}>
					<Box sx={{p: 4}}>
						<Typography variant="h4" gutterBottom>
							Dashboard
						</Typography>
						<Typography variant="h6">Welcome, {user?.name ?? ''}!</Typography>
						<Typography variant="body1" color="textSecondary" gutterBottom>
							Email: {user?.email ?? ''}
						</Typography>
						<Box sx={{mt: 4}}>
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
