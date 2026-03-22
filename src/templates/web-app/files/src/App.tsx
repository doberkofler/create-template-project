import {Typography, Container, Box} from '@mui/material';

export const App = () => {
	return (
		<Container maxWidth="sm">
			<Box sx={{my: 4, textAlign: 'center'}}>
				<Typography variant="h4" component="h1" gutterBottom>
					Hello from React!
				</Typography>
				<Typography variant="body1">This project was scaffolded with the web-app template.</Typography>
			</Box>
		</Container>
	);
};
