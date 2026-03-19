import {ProjectOptions, TemplateDefinition} from '../../types.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getBaseTemplate = (_opts: ProjectOptions): TemplateDefinition => {
	return {
		name: 'base',
		description: 'The foundation for all project templates, including common tooling and configuration.',
		components: [
			{name: 'TypeScript', description: 'Mandatory strict mode for type safety.'},
			{name: 'oxlint', description: 'Ultra-fast Rust-based linter.'},
			{name: 'Prettier', description: 'Consistent code formatting.'},
			{name: 'Vitest', description: 'Modern, fast unit testing with coverage.'},
			{name: 'Husky', description: 'Git hooks for pre-commit linting.'},
			{name: 'commitlint', description: 'Standardized commit messages.'},
			{name: 'conventional-changelog', description: 'Automated release notes.'},
			{name: 'debug', description: 'Structured logging for debugging.'},
			{name: 'Zod', description: 'TypeScript-first schema validation for runtime type safety.'},
		],
		dependencies: {
			zod: 'zod',
		},
		devDependencies: {
			'eslint-plugin-regexp': '',
		},
		scripts: {},
		files: [],
		templateDir: path.resolve(__dirname, 'files'),
	};
};
