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
import {getAllFiles, isSeedFile, mergeFile, mergePackageJson, processContent} from '../utils/file.js';

const debug = debugLib('create-template-project:generator');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEPENDENCY_CONFIG_PATH = path.resolve(__dirname, '../config/dependencies.json');

const pathExists = (p: string) =>
	fs
		.access(p)
		.then(() => true)
		.catch(() => false);

const getLog = (silent: boolean) => ({
	info: (msg: string) => (!silent ? p.log.info(msg) : undefined),
	success: (msg: string) => (!silent ? p.log.success(msg) : undefined),
	warn: (msg: string) => (!silent ? p.log.warn(msg) : undefined),
	error: (msg: string) => (!silent ? p.log.error(msg) : undefined),
});

const getSpinner = (silent: boolean) => {
	const s = p.spinner();
	return {
		start: (msg: string) => (!silent ? s.start(msg) : undefined),
		stop: (msg: string) => (!silent ? s.stop(msg) : undefined),
		message: (msg: string) => (!silent ? s.message(msg) : undefined),
	};
};

const showNote = (msg: string, title?: string, silent?: boolean) => (!silent ? p.note(msg, title) : undefined);

export const generateProject = async (opts: ProjectOptions) => {
	const {template: type, projectName, directory, update, overwrite, skipBuild, silent} = opts;
	const isSilent = !!silent;
	const log = getLog(isSilent);
	const spinner = () => getSpinner(isSilent);
	const projectDir = path.join(directory, projectName);
	debug('Project generation started for: %s', projectName);
	debug('Options: %O', opts);
	debug('Project directory: %s', projectDir);

	let isUpdate = !!update;

	if (await pathExists(projectDir)) {
		if (overwrite) {
			await fs.rm(projectDir, {recursive: true, force: true});
			isUpdate = false; // Directory wiped, treat as fresh creation
		} else if (!isUpdate) {
			throw new Error(`Directory "${projectDir}" already exists. Use --overwrite to replace it or --update to update.`);
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
	await fs.mkdir(projectDir, {recursive: true});

	// Load dependency configuration early
	debug('Loading dependency configuration');
	const depConfig = JSON.parse(await fs.readFile(DEPENDENCY_CONFIG_PATH, 'utf8')) as DependencyConfig;
	const addedDeps: Array<{name: string; description: string}> = [];

	const resolveDeps = (deps: Record<string, string> = {}) => {
		for (const dep of Object.keys(deps)) {
			const config = depConfig.dependencies[dep];
			if (config) {
				deps[dep] = config.version;
				addedDeps.push({name: dep, description: config.description});
			} else {
				log.warn(`Dependency "${dep}" not found in master configuration. Using empty version.`);
				debug(`Dependency "${dep}" missing in config`);
			}
		}
	};

	// Final consolidated data
	let finalPkg: any = {
		name: projectName,
		version: '0.1.0',
		type: 'module',
		'create-template-project': {
			template: type,
		},
		scripts: {},
		dependencies: {},
		devDependencies: {},
	};

	// If update, load existing package.json as base
	const pkgPath = path.join(projectDir, 'package.json');
	if (isUpdate && (await pathExists(pkgPath))) {
		debug('Loading existing package.json for update');
		const existingPkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
		finalPkg = {...finalPkg, ...existingPkg}; // Keep existing name/version/type if they exist
		finalPkg['create-template-project'] = {
			...existingPkg['create-template-project'],
			template: type,
		};
		finalPkg.scripts = {...existingPkg.scripts};
		finalPkg.dependencies = {...existingPkg.dependencies};
		finalPkg.devDependencies = {...existingPkg.devDependencies};
		debug('Loaded existing package.json: %O', finalPkg);
	}

	// First pass: Resolve all dependencies and scripts from all templates
	for (const t of templates) {
		debug('Collecting dependencies and scripts from template: %s', t.name);
		const templateDeps = {...t.dependencies};
		const templateDevDeps = {...t.devDependencies};
		resolveDeps(templateDeps);
		resolveDeps(templateDevDeps);

		Object.assign(finalPkg.scripts, t.scripts);
		Object.assign(finalPkg.dependencies, templateDeps);
		Object.assign(finalPkg.devDependencies, templateDevDeps);

		// Also check physical package.json files in templates
		if (t.templateDir) {
			const templatePkgPath = path.join(t.templateDir, 'package.json');
			if (await pathExists(templatePkgPath)) {
				const pkgPart = JSON.parse(await fs.readFile(templatePkgPath, 'utf8'));
				resolveDeps(pkgPart.dependencies);
				resolveDeps(pkgPart.devDependencies);
				mergePackageJson(finalPkg, pkgPart);
			}
		}
	}

	// Second pass: Process and write files
	for (const t of templates) {
		debug('Processing template files for: %s', t.name);

		// Handle physical files
		if (t.templateDir) {
			debug('Reading physical files from: %s', t.templateDir);
			const files = await getAllFiles(t.templateDir);
			for (const file of files) {
				let relativePath = path.relative(t.templateDir, file);
				let targetPath = path.join(projectDir, relativePath);

				// Skip seed files during update
				if (isUpdate && isSeedFile(relativePath)) {
					debug('Skipping seed file during update: %s', relativePath);
					continue;
				}

				if (relativePath === '_oxlint.config.ts') {
					relativePath = 'oxlint.config.ts';
					targetPath = path.join(projectDir, relativePath);
				}

				if (relativePath === 'package.json') {
					continue;
				}

				await fs.mkdir(path.dirname(targetPath), {recursive: true});

				debug('Reading and processing content for: %s', relativePath);
				let content = await fs.readFile(file, 'utf8');
				content = processContent(relativePath, content, opts, addedDeps);

				// Specific logic for webpage template index.ts/js
				let finalTargetPath = targetPath;
				if (type === 'webpage' && skipBuild && relativePath === 'src/index.ts') {
					debug('Changing target path for webpage index.ts to .js due to skipBuild');
					finalTargetPath = path.join(projectDir, 'src/index.js');
				}

				if (isUpdate && (await pathExists(finalTargetPath))) {
					debug('File exists, attempting to update/merge: %s', finalTargetPath);
					const existingContent = await fs.readFile(finalTargetPath, 'utf8');
					if (existingContent.trim() !== content.trim()) {
						const result = await mergeFile(finalTargetPath, existingContent, content, log);
						if (result === 'merged') log.info(`ℹ Merged: ${relativePath}`);
						else if (result === 'conflict') log.warn(`⚠ Conflict: ${relativePath}`);
						else if (result === 'updated') log.info(`✔ Updated: ${relativePath}`);
					} else {
						debug('Content identical, skipping: %s', finalTargetPath);
					}
				} else {
					debug('Writing file: %s', finalTargetPath);
					await fs.writeFile(finalTargetPath, content);
				}
			}
		}

		// Handle programmatic files
		for (const file of t.files) {
			const targetPath = path.join(projectDir, file.path);
			if (isUpdate && isSeedFile(file.path)) {
				debug('Skipping programmatic seed file: %s', file.path);
				continue;
			}

			debug('Processing programmatic file: %s', file.path);
			await fs.mkdir(path.dirname(targetPath), {recursive: true});
			let content = typeof file.content === 'function' ? file.content() : file.content;
			content = processContent(file.path, content, opts, addedDeps);

			if (isUpdate && (await pathExists(targetPath))) {
				debug('File exists, attempting to update/merge programmatic file: %s', targetPath);
				const existingContent = await fs.readFile(targetPath, 'utf8');
				if (existingContent.trim() !== content.trim()) {
					const result = await mergeFile(targetPath, existingContent, content, log);
					if (result === 'merged') log.info(`ℹ Merged: ${file.path}`);
					else if (result === 'conflict') log.warn(`⚠ Conflict: ${file.path}`);
					else if (result === 'updated') log.info(`✔ Updated: ${file.path}`);
				} else {
					debug('Content identical, skipping programmatic: %s', targetPath);
				}
			} else {
				debug('Writing programmatic file: %s', targetPath);
				await fs.writeFile(targetPath, content);
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

	if (pm === 'pnpm' && finalPkg.workspaces) {
		debug('Creating pnpm-workspace.yaml');
		const workspaceYaml = `packages:\n${finalPkg.workspaces.map((w: string) => `  - '${w}'`).join('\n')}\n`;
		await fs.writeFile(path.join(projectDir, 'pnpm-workspace.yaml'), workspaceYaml);
		delete finalPkg.workspaces;

		for (const [key, value] of Object.entries(finalPkg.scripts)) {
			if (typeof value === 'string' && value.includes('--workspaces')) {
				finalPkg.scripts[key] = (value as string).replace('run ', '-r run ').replace(' --workspaces', '');
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

	// Write final package.json
	debug('Writing final consolidated package.json to: %s', pkgPath);
	await fs.writeFile(pkgPath, JSON.stringify(finalPkg, null, '\t'));

	// Initialize Git
	const isGit = await pathExists(path.join(projectDir, '.git'));
	if (!isGit) {
		debug('Initializing Git repository');
		try {
			await execa('git', ['init'], {cwd: projectDir, preferLocal: true});
			log.success('Initialized Git repository (git init).');
		} catch (e) {
			debug('Failed to initialize Git: %O', e);
			log.error('Failed to initialize Git: ' + e);
		}
	}

	// GitHub Integration
	if (opts.createGithubRepository && !isUpdate) {
		debug('Creating GitHub repository');
		try {
			await execa('gh', ['repo', 'create', projectName, '--public', '--source=.', '--remote=origin'], {
				cwd: projectDir,
				preferLocal: true,
			});
			log.success('Created GitHub repository (gh repo create).');
		} catch (e) {
			debug('Failed to create GitHub repository: %O', e);
			log.warn('Failed to create GitHub repository. Ensure "gh" CLI is installed and authenticated.');
		}
	}

	// Post-scaffolding actions
	if (opts.installDependencies) {
		debug('Installing dependencies using %s', pm);
		const s = spinner();
		s.start(`Installing dependencies using ${pm}...`);
		try {
			await execa(pm, ['install'], {cwd: projectDir, preferLocal: true});
			s.stop(`\x1b[1G\x1b[2K\x1b[32m◆\x1b[39m  Dependencies installed (${pm} install).`);
		} catch (e) {
			debug('Failed to install dependencies: %O', e);
			s.stop('Failed to install dependencies.');
			log.error(String(e));
			throw new Error('Failed to install dependencies.');
		}
	}

	if (opts.build && finalPkg.scripts.ci) {
		debug('Running CI script');
		const s = spinner();

		if (finalPkg.scripts['prettier-write']) {
			s.start(`Formatting files with Prettier (${pm} run prettier-write)...`);
			try {
				await execa(pm, ['run', 'prettier-write'], {cwd: projectDir, preferLocal: true});
				s.stop(`\x1b[1G\x1b[2K\x1b[32m◆\x1b[39m  Files formatted (${pm} run prettier-write).`);
			} catch (e) {
				debug('Failed to format files: %O', e);
				s.stop('Failed to format files.');
			}
		}

		s.start(`Running CI script (lint, build, test) (${pm} run ci)...`);
		try {
			await execa(pm, ['run', 'ci'], {cwd: projectDir, preferLocal: true});
			s.stop(`\x1b[1G\x1b[2K\x1b[32m◆\x1b[39m  CI script completed (${pm} run ci).`);
		} catch (e) {
			debug('Failed to run CI script: %O', e);
			s.stop('Failed to run CI script.');
			log.error(String(e));
			throw new Error('Failed to run CI script.');
		}
	}

	log.info(`Project "${projectName}" ${isUpdate ? 'updated' : 'scaffolded'} successfully in ${projectDir}`);
	showSummary(opts, pm, isSilent);

	if (opts.dev && finalPkg.scripts.dev) {
		log.info('Starting dev server...');
		if (opts.open) {
			try {
				await execa(pm, ['run', 'dev', '--', '--open'], {cwd: projectDir, stdio: 'inherit', preferLocal: true});
			} catch (e) {
				log.error('Dev server failed: ' + e);
			}
		} else {
			try {
				await execa(pm, ['run', 'dev'], {cwd: projectDir, stdio: 'inherit', preferLocal: true});
			} catch (e) {
				log.error('Dev server failed: ' + e);
			}
		}
	}
};

function showSummary(opts: ProjectOptions, pm: string, isSilent: boolean) {
	debug('Showing summary for options: %O', opts);
	const {projectName, template} = opts;

	const summary = [`Successfully created a new ${template} project named '${projectName}'.`, '', 'Available Commands:'];

	const commands = [
		`${pm} run dev    - Starts the development server`,
		`${pm} run build  - Builds the project for production`,
		`${pm} run test   - Runs the unit test suite (Vitest)`,
		`${pm} run lint   - Lints and formats the codebase`,
		`${pm} run ci     - Runs lint, build, and test (used by CI/CD)`,
	];

	showNote([...summary, ...commands.map((c) => `  ${c}`)].join('\n'), 'Project ready', isSilent);
}
