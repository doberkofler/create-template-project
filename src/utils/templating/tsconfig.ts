import {ContentProcessor} from './types.js';

const WEB_ENV = `/* Language and Environment */
		"target": "ES2023" /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */,
		"lib": ["ES2023", "DOM", "DOM.Iterable"] /* Specify a set of bundled library declaration files that describe the target runtime environment. */,
		"module": "ESNext" /* Specify what module code is generated. */,
		"moduleResolution": "bundler" /* Specify how TypeScript looks up a file from a given module specifier. */,
		"esModuleInterop": true /* Emit additional JavaScript to ease support for importing CommonJS modules. */,
		"resolveJsonModule": true /* Enable importing .json files. */,
		"allowImportingTsExtensions": true /* Allow imports to include TypeScript file extensions. */,
		"noEmit": true /* Disable emitting files from a compilation. */,
		"jsx": "react-jsx" /* Specify what JSX code is generated. */,`;

export const tsconfigProcessor: ContentProcessor = (content, {filePath, opts}) => {
	if (filePath !== 'tsconfig.json') {
		return content;
	}

	const {template} = opts;
	let processed = content;

	// Web-Fullstack/Web-Vanilla/Web-App tsconfig.json overrides
	if (template === 'web-fullstack' || template === 'web-vanilla' || template === 'web-app') {
		processed = processed.replace(
			/\/\* Language and Environment \*\/[\s\S]*?\/\* Strict Type-Checking Options \*\//,
			WEB_ENV + '\n\n\t\t/* Strict Type-Checking Options */',
		);
	}

	if (template === 'web-fullstack') {
		processed = processed.replace(/"include":\s*\[\s*"src\/\*\*\/\*"\s*\]/, '"include": ["client/src/**/*", "server/src/**/*"]');
	}

	return processed;
};
