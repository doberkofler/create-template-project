import {ProjectOptions, TemplateDefinition} from '../../types.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getTemplateDir} from '../../utils/file.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getCliTemplate = (opts: ProjectOptions): TemplateDefinition => {
	const components = [
		{name: 'commander', description: 'The complete solution for Node.js command-line interfaces.'},
		{name: 'cli-progress', description: 'Easy to use progress-bar for terminal applications.'},
	];

	if (!opts.skipBuild) {
		components.push({name: 'Vite', description: 'Fast, modern frontend and backend build tool.'});
	}

	return {
		name: 'cli',
		description: 'A robust Node.js command-line application template.',
		components,
		dependencies: {},
		devDependencies: opts.skipBuild ? {} : {vite: 'vite'},
		scripts: {},
		files: [],
		templateDir: getTemplateDir(__dirname, 'cli'),
	};
};
