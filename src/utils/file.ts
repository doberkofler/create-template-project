import path from 'node:path';
import fs from 'node:fs/promises';
import {execa} from 'execa';
import debugLib from 'debug';
import {ProjectOptions} from '../types.js';

const debug = debugLib('create-template-project:utils:file');

export async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
	const files = await fs.readdir(dirPath);

	for (const file of files) {
		if ((await fs.stat(path.join(dirPath, file))).isDirectory()) {
			arrayOfFiles = await getAllFiles(path.join(dirPath, file), arrayOfFiles);
		} else {
			arrayOfFiles.push(path.join(dirPath, file));
		}
	}

	return arrayOfFiles;
}

export function processContent(filePath: string, content: string, opts: ProjectOptions, addedDeps: Array<{name: string; description: string}>): string {
	const {projectName, template} = opts;
	let description = '';

	switch (template) {
		case 'cli':
			description = 'A modern Node.js CLI application with TypeScript and automated tooling.';
			break;
		case 'webpage':
			description = 'A standalone web page/application for modern browsers.';
			break;
		case 'fullstack':
			description = 'A full-stack monorepo with an Express server and a React/MUI client.';
			break;
		case 'webapp':
			description = 'A classic web application with an Express backend.';
			break;
	}

	let processed = content.replaceAll('{{projectName}}', projectName).replaceAll('{{description}}', description);

	// Special logic for webpage template script tag in index.html
	if (template === 'webpage' && filePath === 'index.html') {
		processed = processed.replace('{{scriptSrc}}', opts.skipBuild ? './src/index.js' : './dist/index.mjs');
	}

	// Append dependencies to CONTRIBUTING.md
	if (filePath === 'CONTRIBUTING.md' && addedDeps.length > 0) {
		processed += '\n## Dependencies\n\n';
		const uniqueDeps = Array.from(new Set(addedDeps.map((d) => JSON.stringify(d)))).map((s) => JSON.parse(s)) as Array<{
			name: string;
			description: string;
		}>;
		for (const dep of uniqueDeps) {
			processed += `- **${dep.name}**: ${dep.description}\n`;
		}
	}

	// Fullstack/Webpage/Webapp tsconfig.json overrides
	if ((template === 'fullstack' || template === 'webpage' || template === 'webapp') && filePath === 'tsconfig.json') {
		const webEnv = `/* Language and Environment */
		"target": "ES2023" /* Set the JavaScript language version for emitted JavaScript and include compatible library declarations. */,
		"lib": ["ES2023", "DOM", "DOM.Iterable"] /* Specify a set of bundled library declaration files that describe the target runtime environment. */,
		"module": "ESNext" /* Specify what module code is generated. */,
		"moduleResolution": "bundler" /* Specify how TypeScript looks up a file from a given module specifier. */,
		"esModuleInterop": true /* Emit additional JavaScript to ease support for importing CommonJS modules. */,
		"resolveJsonModule": true /* Enable importing .json files. */,
		"allowImportingTsExtensions": true /* Allow imports to include TypeScript file extensions. */,
		"noEmit": true /* Disable emitting files from a compilation. */,
		"jsx": "react-jsx" /* Specify what JSX code is generated. */,`;

		processed = processed.replace(
			/\/\* Language and Environment \*\/[\s\S]*?\/\* Strict Type-Checking Options \*\//,
			webEnv + '\n\n\t\t/* Strict Type-Checking Options */',
		);
	}

	if (template === 'fullstack' && filePath === 'tsconfig.json') {
		processed = processed.replace(/"include":\s*\[\s*"src\/\*\*\/\*"\s*\]/, '"include": ["client/src/**/*", "server/src/**/*"]');
	}

	return processed;
}

export function mergePackageJson(target: any, source: any) {
	if (source.scripts) {
		target.scripts = {...target.scripts, ...source.scripts};
	}
	if (source.dependencies) {
		target.dependencies = {...target.dependencies, ...source.dependencies};
	}
	if (source.devDependencies) {
		target.devDependencies = {...target.devDependencies, ...source.devDependencies};
	}
	if (source.workspaces) {
		target.workspaces = source.workspaces;
	}
}

export function isSeedFile(filePath: string): boolean {
	const seedDirs = ['src/', 'client/src/', 'server/src/', 'backend/src/', 'frontend/src/'];
	const seedFiles = ['index.html', 'App.tsx', 'main.tsx'];
	return seedDirs.some((dir) => filePath.startsWith(dir)) || seedFiles.some((file) => filePath === file);
}

export async function mergeFile(
	filePath: string,
	existing: string,
	template: string,
	log: {error: (msg: string) => void},
): Promise<'updated' | 'merged' | 'conflict' | 'error'> {
	debug('Merging file: %s', filePath);
	const tempBase = filePath + '.base.tmp';
	const tempNew = filePath + '.new.tmp';

	try {
		await fs.writeFile(tempNew, template);
		await fs.writeFile(tempBase, '');

		try {
			await execa('git', ['merge-file', filePath, tempBase, tempNew], {preferLocal: true});
			const postMergeContent = await fs.readFile(filePath, 'utf8');
			return postMergeContent.trim() !== template.trim() ? 'merged' : 'updated';
		} catch (e: any) {
			if (e.exitCode === 1) {
				return 'conflict';
			} else {
				debug('Git merge-file failed: %O', e);
				log.error(`Failed to merge ${filePath}: ${e.message}`);
				return 'error';
			}
		}
	} finally {
		await fs.rm(tempBase, {force: true});
		await fs.rm(tempNew, {force: true});
	}
}
