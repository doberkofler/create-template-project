import {ProjectOptions, TemplateDefinition} from '../../types.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getFullstackTemplate = (_opts: ProjectOptions): TemplateDefinition => {
	return {
		name: 'fullstack',
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
			zod: 'zod',
			'react-router-dom': 'react-router-dom',
			cors: 'cors',
		},
		devDependencies: {
			'@types/react': '@types/react',
			'@types/react-dom': '@types/react-dom',
			'@types/express': '@types/express',
			'@types/cors': '@types/cors',
			'@playwright/test': '@playwright/test',
			tsdown: 'tsdown',
		},
		scripts: {
			build: 'npm run build --workspaces',
			dev: 'npm run dev --workspaces',
			'test:e2e': 'playwright test',
		},
		files: [],
		templateDir: path.resolve(__dirname, 'files'),
	};
};
