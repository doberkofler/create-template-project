import {ProjectOptions, TemplateDefinition} from '../../types.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const getWebpageTemplate = (_opts: ProjectOptions): TemplateDefinition => {
	return {
		name: 'webpage',
		dependencies: {},
		devDependencies: {},
		scripts: {},
		files: [],
		templateDir: path.resolve(__dirname, 'files'),
	};
};
