import {TemplateDefinition} from '../types.js';

export const getReactTemplate = (): TemplateDefinition => ({
	name: 'react',
	dependencies: {
		react: '^18.3.1',
		'react-dom': '^18.3.1',
		'@mui/material': '^6.1.1',
		'@emotion/react': '^11.13.3',
		'@emotion/styled': '^11.11.5',
		express: '^4.21.0',
	},
	devDependencies: {
		'@types/react': '^18.3.5',
		'@types/react-dom': '^18.3.0',
		'@playwright/test': '^1.47.1',
		tsdown: '^0.20.3',
	},
	scripts: {
		build: 'tsdown',
		'test:e2e': 'playwright test',
	},
	files: [
		{
			path: 'frontend/src/App.tsx',
			content: `import React from 'react';
import { Button, Container, Typography } from '@mui/material';

export const App = () => (
	<Container>
		<Typography variant="h2">React Template</Typography>
		<Button variant="contained">Hello World</Button>
	</Container>
);
`,
		},
		{
			path: 'frontend/src/main.tsx',
			content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);
`,
		},
	],
});
