import {type ProjectOptions, type TemplateDefinition} from '#shared/types.js';
import {getTemplateDir} from '#shared/file.js';

export const getCliTemplate = (_opts: ProjectOptions): TemplateDefinition => {
	const components = [
		{name: 'commander', description: 'The complete solution for Node.js command-line interfaces.'},
		{name: 'cli-progress', description: 'Easy to use progress-bar for terminal applications.'},
		{name: 'Vite', description: 'Fast, modern frontend and backend build tool.'},
	];

	return {
		name: 'cli',
		description: 'A robust Node.js command-line application template.',
		components,
		dependencies: {},
		devDependencies: {vite: 'vite'},
		scripts: {},
		files: [],
		templateDir: getTemplateDir(import.meta.dirname, 'cli'),
	};
};
