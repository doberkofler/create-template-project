import React, {useState} from 'react';
import {
	Button,
	TextField,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Typography,
	Alert,
	Box,
} from '@mui/material';
import {useAuth} from '../contexts/AuthContext.js';
import {trpc} from '../trpc.js';
import {useNavigate} from 'react-router-dom';

export const Login = () => {
	const [email, setEmail] = useState('demo@example.com');
	const [password, setPassword] = useState('password');
	const [error, setError] = useState<string | null>(null);
	const {login} = useAuth();
	const navigate = useNavigate();

	const loginMutation = trpc.auth.login.useMutation({
		onSuccess: (data) => {
			login(data.token, data.user);
			navigate('/dashboard');
		},
		onError: (err) => {
			setError(err.message);
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		loginMutation.mutate({email, password});
	};

	return (
		<Dialog open fullWidth maxWidth="xs">
			<form onSubmit={handleSubmit}>
				<DialogTitle>Login</DialogTitle>
				<DialogContent>
					<Box display="flex" flexDirection="column" gap={2} pt={1}>
						{error && <Alert severity="error">{error}</Alert>}
						<Typography variant="body2" color="textSecondary">
							Use <b>demo@example.com</b> / <b>password</b> to login.
						</Typography>
						<TextField
							label="Email"
							type="email"
							fullWidth
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
						<TextField
							label="Password"
							type="password"
							fullWidth
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button
						type="submit"
						variant="contained"
						fullWidth
						disabled={loginMutation.isPending}
					>
						{loginMutation.isPending ? 'Logging in...' : 'Login'}
					</Button>
				</DialogActions>
			</form>
		</Dialog>
	);
};
