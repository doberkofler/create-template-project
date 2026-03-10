import fse from 'fs-extra';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ProjectOptions, TemplateDefinition, DependencyConfig} from '../types.js';
import {getBaseTemplate} from '../templates/base/index.js';
import {getCliTemplate} from '../templates/cli/index.js';
import {getWebpageTemplate} from '../templates/webpage/index.js';
import {getWebappTemplate} from '../templates/webapp/index.js';
import {getFullstackTemplate} from '../templates/fullstack/index.js';
import {execa} from 'execa';
import * as p from '@clack/prompts';
import debugLib from 'debug';

const debug = debugLib('create-template-project:generator');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEPENDENCY_CONFIG_PATH = path.resolve(__dirname, '../config/dependencies.json');

export const generateProject = async (opts: ProjectOptions) => {
	const {template: type, projectName, directory, force, update, overwrite, skipBuild} = opts;
	const projectDir = path.join(directory, projectName);
	debug('Project generation started for: %s', projectName);
	debug('Options: %O', opts);
	debug('Project directory: %s', projectDir);

	const isUpdate = !!update;

	if (await fse.pathExists(projectDir)) {
		if (force) {
			await fs.rm(projectDir, {recursive: true, force: true});
		} else if (!isUpdate && !overwrite) {
			throw new Error(`Directory "${projectDir}" already exists. Use --force to remove, --overwrite to overwrite or --update to update.`);
		}
	}

	const templates: TemplateDefinition[] = [getBaseTemplate(opts)];

	debug('Applying template: base');
	switch (type) {
		case 'cli':
			debug('Applying template: cli');
			templates.push(getCliTemplate(opts));
			break;
		case 'webpage':
			debug('Applying template: webpage');
			templates.push(getWebpageTemplate(opts));
			break;
		case 'webapp':
			debug('Applying template: webapp');
			templates.push(getWebappTemplate(opts));
			break;
		case 'fullstack':
			debug('Applying template: fullstack');
			templates.push(getFullstackTemplate(opts));
			break;
	}

	debug('Ensuring directory exists: %s', projectDir);
	await fse.ensureDir(projectDir);

	// Final consolidated data
	let finalPkg: any = {
		name: projectName,
		version: '0.1.0',
		type: 'module',
		scripts: {},
		dependencies: {},
		devDependencies: {},
	};

	// If update, load existing package.json as base
	if (isUpdate && (await fse.pathExists(path.join(projectDir, 'package.json')))) {
		debug('Loading existing package.json for update');
		const existingPkg = await fse.readJson(path.join(projectDir, 'package.json'));
		finalPkg = {...finalPkg, ...existingPkg}; // Keep existing name/version/type if they exist
		finalPkg.scripts = {...existingPkg.scripts};
		finalPkg.dependencies = {...existingPkg.dependencies};
		finalPkg.devDependencies = {...existingPkg.devDependencies};
		debug('Loaded existing package.json: %O', finalPkg);
	}

	for (const t of templates) {
		debug('Processing template files and metadata');
		// Merge programmatic deps/scripts
		Object.assign(finalPkg.scripts, t.scripts);
		Object.assign(finalPkg.dependencies, t.dependencies);
		Object.assign(finalPkg.devDependencies, t.devDependencies);

		// Handle physical files
		if (t.templateDir) {
			debug('Reading physical files from: %s', t.templateDir);
			const files = await getAllFiles(t.templateDir);
			for (const file of files) {
				const relativePath = path.relative(t.templateDir, file);
				const targetPath = path.join(projectDir, relativePath);

				// Skip seed files during update
				if (isUpdate && isSeedFile(relativePath)) {
					debug('Skipping seed file during update: %s', relativePath);
					continue;
				}

				if (relativePath === 'package.json') {
					debug('Merging package.json parts');
					const pkgPart = await fse.readJson(file);
					mergePackageJson(finalPkg, pkgPart);
					continue;
				}

				await fse.ensureDir(path.dirname(targetPath));

				debug('Reading and replacing variables for: %s', relativePath);
				let content = await fse.readFile(file, 'utf8');
				content = replaceVariables(content, opts);

				// Specific logic for webpage template script tag
				if (type === 'webpage' && relativePath === 'index.html') {
					debug('Applying webpage index.html specific replacement');
					content = content.replace('{{scriptSrc}}', skipBuild ? './src/index.js' : './dist/index.js');
				}

				// Specific logic for webpage template index.ts/js
				let finalTargetPath = targetPath;
				if (type === 'webpage' && skipBuild && relativePath === 'src/index.ts') {
					debug('Changing target path for webpage index.ts to .js due to skipBuild');
					finalTargetPath = path.join(projectDir, 'src/index.js');
				}

				if (isUpdate && (await fse.pathExists(finalTargetPath))) {
					debug('File exists, attempting to merge: %s', finalTargetPath);
					const existingContent = await fse.readFile(finalTargetPath, 'utf8');
					if (existingContent !== content) {
						await mergeFile(finalTargetPath, existingContent, content);
					} else {
						debug('Content identical, skipping merge: %s', finalTargetPath);
					}
				} else {
					debug('Writing file: %s', finalTargetPath);
					await fse.writeFile(finalTargetPath, content);
				}
			}
		}

		// Handle programmatic files (for backward compat or complex cases)
		for (const file of t.files) {
			const targetPath = path.join(projectDir, file.path);
			if (isUpdate && isSeedFile(file.path)) {
				debug('Skipping programmatic seed file: %s', file.path);
				continue;
			}

			debug('Processing programmatic file: %s', file.path);
			await fse.ensureDir(path.dirname(targetPath));
			const content = typeof file.content === 'function' ? file.content() : file.content;

			if (isUpdate && (await fse.pathExists(targetPath))) {
				debug('File exists, attempting to merge programmatic file: %s', targetPath);
				const existingContent = await fse.readFile(targetPath, 'utf8');
				if (existingContent !== content) {
					await mergeFile(targetPath, existingContent, content);
				} else {
					debug('Content identical, skipping programmatic merge: %s', targetPath);
				}
			} else {
				debug('Writing programmatic file: %s', targetPath);
				await fse.writeFile(targetPath, content);
			}
		}
	}

	// Apply final programmatic overrides
	const pm = opts.packageManager || 'npm';

	if (pm !== 'npm') {
		for (const [key, value] of Object.entries(finalPkg.scripts)) {
			if (typeof value === 'string') {
				finalPkg.scripts[key] = (value as string).replaceAll('npm run ', `${pm} run `);
			}
		}
	}

	if (skipBuild) {
		debug('Applying skipBuild overrides');
		delete finalPkg.scripts.build;
		delete finalPkg.scripts.dev;
		if (finalPkg.devDependencies) {
			delete finalPkg.devDependencies.tsdown;
		}
		if (finalPkg.scripts.ci) {
			finalPkg.scripts.ci = finalPkg.scripts.ci.replace(' && npm run build', '').replace(` && ${pm} run build`, '');
		}
		// Remove tsdown.config.ts if it was copied
		debug('Removing tsdown configs due to skipBuild');
		await fs.rm(path.join(projectDir, 'tsdown.config.ts'), {force: true});
		await fs.rm(path.join(projectDir, 'client/tsdown.config.ts'), {force: true});
		await fs.rm(path.join(projectDir, 'server/tsdown.config.ts'), {force: true});
	}

	// Resolve versions from master dependency config
	debug('Loading dependency configuration');
	const depConfig = (await fse.readJson(DEPENDENCY_CONFIG_PATH)) as DependencyConfig;
	const addedDeps: Array<{name: string; description: string}> = [];

	const resolveDeps = (deps: Record<string, string> = {}) => {
		for (const dep of Object.keys(deps)) {
			const config = depConfig.dependencies[dep];
			if (config) {
				deps[dep] = config.version;
				addedDeps.push({name: dep, description: config.description});
			} else {
				p.log.warn(`Dependency "${dep}" not found in master configuration. Using empty version.`);
				debug(`Dependency "${dep}" missing in config`);
			}
		}
	};

	resolveDeps(finalPkg.dependencies);
	resolveDeps(finalPkg.devDependencies);

	// Write final package.json
	const finalPkgPath = path.join(projectDir, 'package.json');
	debug('Writing final consolidated package.json to: %s', finalPkgPath);
	await fse.writeJson(finalPkgPath, finalPkg, {spaces: '\t'});

	// For fullstack templates, adjust the tsconfig.json include paths
	if (type === 'fullstack') {
		const tsconfigPath = path.join(projectDir, 'tsconfig.json');
		if (await fse.pathExists(tsconfigPath)) {
			let tsconfigContent = await fse.readFile(tsconfigPath, 'utf8');
			tsconfigContent = tsconfigContent.replace(/"src\/\*\*\/\*"/g, '"client/src/**/*",\n\t\t"server/src/**/*"');
			await fse.writeFile(tsconfigPath, tsconfigContent);
			debug('Updated tsconfig.json includes for fullstack template');
		}
	}

	// Initialize Git
	const isGit = await fse.pathExists(path.join(projectDir, '.git'));
	if (!isGit) {
		debug('Initializing Git repository');
		try {
			await execa('git', ['init'], {cwd: projectDir});
			p.log.success('Initialized Git repository.');
		} catch (e) {
			debug('Failed to initialize Git: %O', e);
			p.log.error('Failed to initialize Git: ' + e);
		}
	} else {
		debug('Git repository already initialized');
	}

	// GitHub Integration
	if (opts.createGithubRepository && !isUpdate) {
		debug('Creating GitHub repository');
		try {
			await execa('gh', ['repo', 'create', projectName, '--public', '--source=.', '--remote=origin'], {
				cwd: projectDir,
			});
			p.log.success('Created GitHub repository.');
		} catch (e) {
			debug('Failed to create GitHub repository: %O', e);
			p.log.warn('Failed to create GitHub repository. Ensure "gh" CLI is installed and authenticated.');
		}
	}

	// Post-scaffolding actions
	if (opts.installDependencies) {
		debug('Installing dependencies using %s', pm);
		const s = p.spinner();
		s.start(`Installing dependencies using ${pm}...`);
		try {
			await execa(pm, ['install'], {cwd: projectDir});
			s.stop('Dependencies installed.');
		} catch (e) {
			debug('Failed to install dependencies: %O', e);
			s.stop('Failed to install dependencies.');
			p.log.error(String(e));
		}
	}

	if (opts.build && finalPkg.scripts.build) {
		debug('Building project');
		const s = p.spinner();
		s.start('Building project...');
		try {
			await execa(pm, ['run', 'build'], {cwd: projectDir});
			s.stop('Project built.');
		} catch (e) {
			debug('Failed to build project: %O', e);
			s.stop('Failed to build project.');
			p.log.error(String(e));
		}
	}

	p.log.info(`Project "${projectName}" ${isUpdate ? 'updated' : 'scaffolded'} successfully in ${projectDir}`);
	showSummary(opts, pm, addedDeps);

	if (opts.dev && finalPkg.scripts.dev) {
		p.log.info('Starting dev server...');
		if (opts.open) {
			// Try to open the browser. Many dev servers have an --open flag.
			// For vite, we can pass --open.
			try {
				await execa(pm, ['run', 'dev', '--', '--open'], {cwd: projectDir, stdio: 'inherit'});
			} catch (e) {
				p.log.error('Dev server failed: ' + e);
			}
		} else {
			try {
				await execa(pm, ['run', 'dev'], {cwd: projectDir, stdio: 'inherit'});
			} catch (e) {
				p.log.error('Dev server failed: ' + e);
			}
		}
	}
};

async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
	const files = await fse.readdir(dirPath);

	for (const file of files) {
		if ((await fse.stat(path.join(dirPath, file))).isDirectory()) {
			arrayOfFiles = await getAllFiles(path.join(dirPath, file), arrayOfFiles);
		} else {
			arrayOfFiles.push(path.join(dirPath, file));
		}
	}

	return arrayOfFiles;
}

function replaceVariables(content: string, opts: ProjectOptions): string {
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

	return content.replaceAll('{{projectName}}', projectName).replaceAll('{{description}}', description);
}

function mergePackageJson(target: any, source: any) {
	if (source.scripts) target.scripts = {...target.scripts, ...source.scripts};
	if (source.dependencies) target.dependencies = {...target.dependencies, ...source.dependencies};
	if (source.devDependencies) target.devDependencies = {...target.devDependencies, ...source.devDependencies};
	if (source.workspaces) target.workspaces = source.workspaces;
}

function isSeedFile(filePath: string): boolean {
	const seedDirs = ['src/', 'client/src/', 'server/src/', 'backend/src/', 'frontend/src/'];
	const seedFiles = ['index.html', 'App.tsx', 'main.tsx'];
	return seedDirs.some((dir) => filePath.startsWith(dir)) || seedFiles.some((file) => filePath === file);
}

async function mergeFile(filePath: string, existing: string, template: string) {
	debug('Merging file: %s', filePath);
	const tempBase = filePath + '.base.tmp';
	const tempNew = filePath + '.new.tmp';

	try {
		await fse.writeFile(tempNew, template);
		await fse.writeFile(tempBase, '');

		try {
			debug('Executing git merge-file for %s', filePath);
			await execa('git', ['merge-file', filePath, tempBase, tempNew]);
		} catch (e: any) {
			if (e.exitCode === 1) {
				debug('Merge conflict in %s', filePath);
				p.log.warn(`Conflict in ${filePath}. Please resolve manually.`);
			} else {
				debug('Git merge-file failed: %O', e);
				p.log.error(`Failed to merge ${filePath}: ${e.message}`);
			}
		}
	} finally {
		await fs.rm(tempBase, {force: true});
		await fs.rm(tempNew, {force: true});
	}
}

function showSummary(opts: ProjectOptions, pm: string, dependencies: Array<{name: string; description: string}>) {
	debug('Showing summary for options: %O', opts);
	const {template, skipBuild, installDependencies, build, dev, open, projectName} = opts;

	const descriptions: Record<string, string> = {
		cli: 'A modern Node.js CLI application with TypeScript, automated tooling, and argument parsing.',
		webpage: 'A standalone web page/application ready for modern browsers.',
		fullstack: 'A full-stack monorepo featuring an Express server API and a React/MUI client front-end.',
		webapp: 'A classic web application utilizing an Express backend and standard templating.',
	};

	const desc = descriptions[template] || 'A new template project.';

	// The array format avoids stray tabs and newlines that break the clack box rendering
	p.note(
		[
			`Project:          ${projectName}`,
			`Template:         ${template}`,
			`Package manager:  ${pm}`,
			`Tools included:   tsc, oxlint, prettier, vitest, husky, debug`,
			``,
			`Configuration:`,
			`  Install deps:   ${installDependencies ? 'Yes' : 'No'}`,
			`  Build on init:  ${build ? 'Yes' : 'No'}`,
			`  Start dev:      ${dev ? 'Yes' : 'No'}`,
			`  Open browser:   ${open ? 'Yes' : 'No'}`,
		].join('\n'),
		'Project Summary',
	);

	p.log.info([`About this project:`, `  ${desc}`, `  All essential tools (linting, formatting, testing) are pre-configured.`].join('\n'));

	if (dependencies.length > 0) {
		p.log.info('Dependencies:');
		// Remove duplicates if any (e.g. if resolved multiple times)
		const uniqueDeps = Array.from(new Set(dependencies.map((d) => JSON.stringify(d)))).map((s) => JSON.parse(s));
		for (const dep of uniqueDeps) {
			p.log.info(`${dep.name} - ${dep.description}`);
		}
	}

	p.log.info(
		[
			`Available Commands:`,
			`  ${pm} run dev    - Starts the development server`,
			`  ${pm} run build  - Builds the project for production`,
			`  ${pm} run test   - Runs the unit test suite (Vitest)`,
			`  ${pm} run lint   - Lints and formats the codebase`,
			`  ${pm} run ci     - Runs lint, build, and test (used by CI/CD)`,
		].join('\n'),
	);

	const nextSteps = [];
	const relativePath = path.relative(process.cwd(), path.join(opts.directory, opts.projectName));
	if (relativePath && relativePath !== '.') {
		nextSteps.push(`  cd ${relativePath}`);
	}
	if (!installDependencies) {
		nextSteps.push(`  ${pm} install`);
	}
	if (!dev) {
		if (!skipBuild) {
			nextSteps.push(`  ${pm} run dev`);
		}
		nextSteps.push(`  ${pm} run test`);
	}

	p.log.success([`Next steps:`, ...nextSteps].join('\n'));
}
