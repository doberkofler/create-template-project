import {ProjectOptions, TemplateDefinition} from '../../types.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getCliTemplate = (opts: ProjectOptions): TemplateDefinition => {
	const components = [
		{name: 'commander', description: 'The complete solution for Node.js command-line interfaces.'},
		{name: 'cli-progress', description: 'Easy to use progress-bar for terminal applications.'},
	];

	if (!opts.skipBuild) {
		components.push({name: 'tsdown', description: 'A zero-config bundler for TypeScript.'});
	}

	return {
		name: 'cli',
		description: 'A robust Node.js command-line application template.',
		components,
		dependencies: {},
		devDependencies: {},
		scripts: {},
		files: [],
		templateDir: path.resolve(__dirname, 'files'),
	};
};
