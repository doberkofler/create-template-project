import {ProjectOptions, TemplateDefinition} from '../../types.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getWebappTemplate = (_opts: ProjectOptions): TemplateDefinition => {
	return {
		name: 'webapp',
		description: 'A full-featured web application with a separate Express backend and Vite-powered frontend.',
		components: [
			{name: 'Express', description: 'Fast, minimalist web framework for the backend.'},
			{name: 'React', description: 'Powerful library for building component-based user interfaces.'},
			{name: 'MUI', description: 'Rich set of Material Design UI components for React.'},
			{name: 'TanStack React Query', description: 'Powerful asynchronous state management for React.'},
			{name: 'Vite', description: 'Next-generation frontend tooling.'},
			{name: 'Vitest', description: 'Testing framework with cross-browser support.'},
			{name: 'Playwright', description: 'End-to-end testing for full applications.'},
		],
		dependencies: {
			express: 'express',
			react: 'react',
			'react-dom': 'react-dom',
			'@mui/material': '@mui/material',
			'@mui/icons-material': '@mui/icons-material',
			'@emotion/react': '@emotion/react',
			'@emotion/styled': '@emotion/styled',
			'@tanstack/react-query': '@tanstack/react-query',
		},
		devDependencies: {
			'@types/express': '@types/express',
			'@types/react': '@types/react',
			'@types/react-dom': '@types/react-dom',
			vite: 'vite',
			'@vitejs/plugin-react': '@vitejs/plugin-react',
			vitest: 'vitest',
			'@vitest/browser': '@vitest/browser',
			'@vitest/browser-playwright': '@vitest/browser-playwright',
			playwright: 'playwright',
			'@playwright/test': '@playwright/test',
		},
		scripts: {
			dev: 'vite',
			build: 'vite build',
			preview: 'vite preview',
			test: 'vitest run',
			'test:ui': 'vitest',
			'test:e2e': 'playwright test',
			start: 'node dist/server/index.js',
		},
		files: [],
		templateDir: path.resolve(__dirname, 'files'),
	};
};
