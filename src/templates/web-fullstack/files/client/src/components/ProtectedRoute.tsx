/* eslint-disable import/no-relative-parent-imports */
import {Navigate, Outlet} from 'react-router-dom';
import {type ReactNode} from 'react';
import {useAuth} from '../contexts/AuthContext.js';
import {CircularProgress, Box} from '@mui/material';

export const ProtectedRoute = (): ReactNode => {
	const {token, isLoading} = useAuth();

	if (isLoading) {
		return (
			<Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh'}}>
				<CircularProgress />
			</Box>
		);
	}

	if (token === null || token === '') {
		return <Navigate to="/login" replace />;
	}

	return <Outlet />;
};
