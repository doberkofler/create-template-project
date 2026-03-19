import {createRoot} from 'react-dom/client';
import {Typography, Container, Box} from '@mui/material';

const App = () => {
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

const container = document.getElementById('app');
if (container) {
	const root = createRoot(container);
	root.render(<App />);
}
