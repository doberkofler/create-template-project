import {type ProjectOptions, type TemplateDefinition} from '#shared/types.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getTemplateDir} from '#shared/file.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getWebAppTemplate = (_opts: ProjectOptions): TemplateDefinition => ({
	name: 'web-app',
	description: 'A React application with MUI and TanStack Query, powered by Vite.',
	components: [
		{name: 'React', description: 'Powerful library for building component-based user interfaces.'},
		{name: 'MUI', description: 'Rich set of Material Design UI components for React.'},
		{name: 'TanStack React Query', description: 'Powerful asynchronous state management for React.'},
		{name: 'Vite', description: 'Next-generation frontend tooling.'},
		{name: 'Vitest', description: 'Testing framework with cross-browser support.'},
		{name: 'Playwright', description: 'End-to-end testing for modern web apps.'},
	],
	dependencies: {
		react: 'react',
		'react-dom': 'react-dom',
		'@mui/material': '@mui/material',
		'@mui/icons-material': '@mui/icons-material',
		'@emotion/react': '@emotion/react',
		'@emotion/styled': '@emotion/styled',
		'@tanstack/react-query': '@tanstack/react-query',
	},
	devDependencies: {
		'@types/react': '@types/react',
		'@types/react-dom': '@types/react-dom',
		vite: 'vite',
		'@vitejs/plugin-react': '@vitejs/plugin-react',
		vitest: 'vitest',
		'@vitest/browser': '@vitest/browser',
		'@vitest/browser-playwright': '@vitest/browser-playwright',
		playwright: 'playwright',
		'@playwright/test': '@playwright/test',
		'vitest-browser-react': 'vitest-browser-react',
	},
	scripts: {
		dev: 'vite',
		build: 'vite build',
		preview: 'vite preview',
		test: 'vitest run',
		'test:ui': 'vitest',
		'integration-test': 'playwright test',
		start: 'vite preview',
	},
	files: [],
	templateDir: getTemplateDir(__dirname, 'web-app'),
});
