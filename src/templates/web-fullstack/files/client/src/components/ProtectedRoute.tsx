import {Navigate, Outlet} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext.js';
import {CircularProgress, Box} from '@mui/material';

export const ProtectedRoute = () => {
	const {token, isLoading} = useAuth();

	if (isLoading) {
		return (
			<Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
				<CircularProgress />
			</Box>
		);
	}

	if (!token) {
		return <Navigate to="/login" replace />;
	}

	return <Outlet />;
};
