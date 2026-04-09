/* eslint-disable react/jsx-max-depth */
import {useState, type ReactNode} from 'react';
import {BrowserRouter, Routes, Route, Navigate} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {httpBatchLink} from '@trpc/client';
import {trpc} from './trpc.js';
import {AuthProvider} from './contexts/AuthContext.js';
import {ProtectedRoute} from './components/ProtectedRoute.js';
import {Login} from './pages/Login.js';
import {Dashboard} from './pages/Dashboard.js';
import {CssBaseline, ThemeProvider, createTheme} from '@mui/material';

const theme = createTheme();

export const App = (): ReactNode => {
	const [queryClient] = useState(() => new QueryClient());
	const [trpcClient] = useState(() =>
		trpc.createClient({
			links: [
				httpBatchLink({
					url: 'http://localhost:3001/trpc',
					headers: () => {
						const token = localStorage.getItem('token');
						return token !== null && token !== '' ? {Authorization: `Bearer ${token}`} : {};
					},
				}),
			],
		}),
	);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider theme={theme}>
					<CssBaseline />
					<AuthProvider>
						<BrowserRouter>
							<Routes>
								<Route path="/login" element={<Login />} />
								<Route element={<ProtectedRoute />}>
									<Route path="/dashboard" element={<Dashboard />} />
								</Route>
								<Route path="*" element={<Navigate to="/dashboard" replace />} />
							</Routes>
						</BrowserRouter>
					</AuthProvider>
				</ThemeProvider>
			</QueryClientProvider>
		</trpc.Provider>
	);
};
