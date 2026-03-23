import path from 'node:path';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execa} from 'execa';
import debugLib from 'debug';
import {ProjectOptions} from '../types.js';

const debug = debugLib('create-template-project:utils:file');

export function getTemplateDir(dirname: string, templateName: string): string {
	const sourcePath = path.resolve(dirname, 'files');
	const distPath = path.resolve(dirname, 'templates', templateName, 'files');
	return existsSync(distPath) ? distPath : sourcePath;
}

export async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
	const files = await fs.readdir(dirPath);

	for (const file of files) {
		if (file === '.DS_Store') {
			continue;
		}
		if ((await fs.stat(path.join(dirPath, file))).isDirectory()) {
			arrayOfFiles = await getAllFiles(path.join(dirPath, file), arrayOfFiles);
		} else {
			arrayOfFiles.push(path.join(dirPath, file));
		}
	}

	return arrayOfFiles;
}

export function processContent(filePath: string, content: string, opts: ProjectOptions, addedDeps: Array<{name: string; description: string}>): string {
	const {projectName, template, author} = opts;
	let description = '';

	switch (template) {
		case 'cli':
			description = 'A modern Node.js CLI application with TypeScript and automated tooling.';
			break;
		case 'web-vanilla':
			description = 'A standalone web page/application for modern browsers.';
			break;
		case 'web-fullstack':
			description = 'A full-stack monorepo with an Express server and a React/MUI client.';
			break;
		case 'web-app':
			description = 'A React application with MUI and TanStack Query.';
			break;
	}

	const pm = opts.packageManager || 'npm';
	const lockfileRules = pm === 'pnpm' ? 'package-lock.json\nyarn.lock' : pm === 'yarn' ? 'package-lock.json\npnpm-lock.yaml' : 'yarn.lock\npnpm-lock.yaml';

	let processed = content
		.replaceAll('{{projectName}}', projectName)
		.replaceAll('{{description}}', description)
		.replaceAll('{{packageManager}}', pm)
		.replaceAll('{{author}}', author || '')
		.replaceAll('{{year}}', new Date().getFullYear().toString())
		.replaceAll('{{lockfileRules}}', lockfileRules);

	// Special logic for GitHub Actions workflow
	if (filePath.includes('.github/workflows/node.js.yml')) {
		let installCommand = 'npm ci';
		let pmSetup = '';
		if (pm === 'pnpm') {
			installCommand = 'pnpm install --frozen-lockfile';
			pmSetup = '- uses: pnpm/action-setup@v4\n        with:\n          version: 9';
		} else if (pm === 'yarn') {
			installCommand = 'yarn install --frozen-lockfile';
		}

		let playwrightSetup = '';
		if (template === 'web-fullstack' || template === 'web-app' || template === 'web-vanilla') {
			playwrightSetup = '- name: Install Playwright Browsers & Deps\n        run: npx playwright install --with-deps chromium';
		}

		processed = processed
			.replaceAll('{{installCommand}}', installCommand)
			.replaceAll('# [PM_SETUP]', pmSetup)
			.replaceAll('# [PLAYWRIGHT_SETUP]', playwrightSetup);

		// Clean up empty lines from empty placeholders
		processed = processed.replace(/^\s*# \[PM_SETUP\]\s*\n/m, '');
		processed = processed.replace(/^\s*# \[PLAYWRIGHT_SETUP\]\s*\n/m, '');
	}

	// Special logic for web-vanilla template script tag in index.html
	if (template === 'web-vanilla' && filePath === 'index.html') {
		processed = processed.replace('{{scriptSrc}}', '/src/index.ts');
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

	// Web-Fullstack/Web-Vanilla/Web-App tsconfig.json overrides
	if ((template === 'web-fullstack' || template === 'web-vanilla' || template === 'web-app') && filePath === 'tsconfig.json') {
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

	if (template === 'web-fullstack' && filePath === 'tsconfig.json') {
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
		target.devDependencies = {
			...target.devDependencies,
			...source.devDependencies,
		};
	}
	if (source.workspaces) {
		target.workspaces = source.workspaces;
	}
	if (source.bin) {
		target.bin = source.bin;
	}
}

export function isSeedFile(filePath: string): boolean {
	const seedDirs = ['src/', 'client/src/', 'server/src/', 'backend/src/', 'frontend/src/'];
	const seedFiles = ['index.html', 'App.tsx', 'main.tsx', 'index.tsx', 'LICENSE'];
	return seedDirs.some((dir) => filePath.startsWith(dir)) || seedFiles.some((file) => filePath === file) || filePath.toLowerCase().endsWith('.md');
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
			const stdio = debug.enabled ? 'inherit' : 'pipe';
			debug('Executing: git merge-file %s %s %s', filePath, tempBase, tempNew);
			await execa('git', ['merge-file', filePath, tempBase, tempNew], {
				stdio,
				preferLocal: true,
			});
			const postMergeContent = await fs.readFile(filePath, 'utf8');
			return postMergeContent.trim() !== template.trim() ? 'merged' : 'updated';
		} catch (e: any) {
			if (e.exitCode >= 1 && e.exitCode < 128) {
				return 'conflict';
			} else {
				debug('Git merge-file failed: %O', e);
				const detail = e.stdout || e.stderr ? `\n\nOutput:\n${e.stdout}\n${e.stderr}` : '';
				log.error(`Failed to merge ${filePath}: ${e.message}${detail}`);
				return 'error';
			}
		}
	} finally {
		await fs.rm(tempBase, {force: true});
		await fs.rm(tempNew, {force: true});
	}
}
