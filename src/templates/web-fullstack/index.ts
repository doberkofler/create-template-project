import {ProjectOptions, TemplateDefinition} from '../../types.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getTemplateDir} from '../../utils/file.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getWebFullstackTemplate = (_opts: ProjectOptions): TemplateDefinition => {
	return {
		name: 'web-fullstack',
		description: 'A comprehensive full-stack monorepo featuring an Express backend with tRPC and a modern React client with MUI.',
		components: [
			{name: 'React', description: 'Powerful library for building component-based user interfaces.'},
			{name: 'MUI', description: 'Rich set of Material Design UI components for React.'},
			{name: 'tRPC', description: 'End-to-end typesafe APIs made easy.'},
			{name: 'React Query', description: 'Powerful asynchronous state management for React.'},
			{name: 'Express', description: 'Fast, minimalist backend web framework.'},
			{name: 'React Router', description: 'Declarative routing for the frontend.'},
			{name: 'Vite', description: 'Fast, modern frontend build tool.'},
		],
		dependencies: {
			react: 'react',
			'react-dom': 'react-dom',
			'@mui/material': '@mui/material',
			'@mui/icons-material': '@mui/icons-material',
			'@emotion/react': '@emotion/react',
			'@emotion/styled': '@emotion/styled',
			express: 'express',
			'@trpc/server': '@trpc/server',
			'@trpc/client': '@trpc/client',
			'@trpc/react-query': '@trpc/react-query',
			'@tanstack/react-query': '@tanstack/react-query',
			'react-router-dom': 'react-router-dom',
			cors: 'cors',
		},
		devDependencies: {
			'@types/react': '@types/react',
			'@types/react-dom': '@types/react-dom',
			'@types/express': '@types/express',
			'@types/cors': '@types/cors',
			'@playwright/test': '@playwright/test',
			vite: 'vite',
			'@vitejs/plugin-react': '@vitejs/plugin-react',
			vitest: 'vitest',
			'@vitest/browser': '@vitest/browser',
			'@vitest/browser-playwright': '@vitest/browser-playwright',
			playwright: 'playwright',
		},
		scripts: {
			build: 'npm run build --workspaces',
			dev: 'npm run dev --workspaces',
			test: 'npm run test --workspaces',
			'test:e2e': 'playwright test',
		},
		files: [],
		templateDir: getTemplateDir(__dirname, 'web-fullstack'),
	};
};
