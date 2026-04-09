import {type ProjectOptions, type TemplateDefinition} from '#shared/types.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getTemplateDir} from '#shared/file.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getWebVanillaTemplate = (_opts: ProjectOptions): TemplateDefinition => ({
	name: 'web-vanilla',
	description: 'A modern, standalone web page template with built-in development and testing tooling.',
	components: [
		{name: 'Vite', description: 'Fast frontend build tool and development server.'},
		{name: 'Vitest', description: 'Modern testing framework with browser support.'},
		{name: 'Playwright', description: 'Comprehensive end-to-end testing for modern web apps.'},
	],
	dependencies: {},
	devDependencies: {
		vite: 'vite',
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
		'integration-test': 'playwright test',
	},
	files: [],
	templateDir: getTemplateDir(__dirname, 'web-vanilla'),
});
