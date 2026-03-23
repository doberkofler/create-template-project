import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {ProjectOptions, TemplateDefinition, DependencyConfig} from '../types.js';
import {getBaseTemplate} from '../templates/base/index.js';
import {getCliTemplate} from '../templates/cli/index.js';
import {getWebVanillaTemplate} from '../templates/web-vanilla/index.js';
import {getWebAppTemplate} from '../templates/web-app/index.ts';
import {getWebFullstackTemplate} from '../templates/web-fullstack/index.js';
import {execa} from 'execa';
import * as p from '@clack/prompts';
import debugLib from 'debug';
import {getAllFiles, isSeedFile, mergeFile, mergePackageJson, processContent} from '../utils/file.js';

const debug = debugLib('create-template-project:generator');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const getDependencyConfigPath = async () => {
	const sourcePath = path.resolve(__dirname, '../config/dependencies.json');
	const distPath = path.resolve(__dirname, 'config/dependencies.json');
	return (await pathExists(distPath)) ? distPath : sourcePath;
};

const pathExists = (p: string) =>
	fs
		.access(p)
		.then(() => true)
		.catch(() => false);

const getLog = (progress: boolean) => ({
	info: (msg: string) => (progress ? p.log.info(msg) : undefined),
	success: (msg: string) => (progress ? p.log.success(msg) : undefined),
	warn: (msg: string) => p.log.warn(msg),
	error: (msg: string) => p.log.error(msg),
});

const getSpinner = (progress: boolean) => {
	const s = p.spinner();
	return {
		start: (msg: string) => (progress ? s.start(msg) : undefined),
		stop: (msg: string) => (progress ? s.stop(msg) : undefined),
	};
};

const showNote = (msg: string, title?: string, progress?: boolean) => {
	if (progress !== undefined && !progress) {
		return;
	}
	if (title) {
		p.log.success(title);
	}
	p.note(msg);
};

const isFileRequired = (relativePath: string, type: string) => {
	if (relativePath === 'vitest.config.ts') {
		return !['cli', 'web-vanilla', 'web-app', 'web-fullstack'].includes(type);
	}
	return true;
};

export const generateProject = async (opts: ProjectOptions) => {
	const {template: type, projectName, author, directory, update, progress} = opts;
	const isProgress = progress !== false;
	const log = getLog(isProgress);
	const spinner = () => getSpinner(isProgress);
	const projectDir = directory;
	debug('Project generation started for: %s', projectName);
	debug('Options: %O', opts);
	debug('Project directory: %s', projectDir);

	let isUpdate = !!update;

	if (await pathExists(projectDir)) {
		if (!isUpdate) {
			throw new Error(`Directory "${projectDir}" already exists. Use the "update" command to update.`);
		}
	}

	const templates: TemplateDefinition[] = [getBaseTemplate(opts)];

	debug('Applying template: base');
	switch (type) {
		case 'cli':
			debug('Applying template: cli');
			templates.push(getCliTemplate(opts));
			break;
		case 'web-vanilla':
			debug('Applying template: web-vanilla');
			templates.push(getWebVanillaTemplate(opts));
			break;
		case 'web-app':
			debug('Applying template: web-app');
			templates.push(getWebAppTemplate(opts));
			break;
		case 'web-fullstack':
			debug('Applying template: web-fullstack');
			templates.push(getWebFullstackTemplate(opts));
			break;
	}

	debug('Ensuring directory exists: %s', projectDir);
	await fs.mkdir(projectDir, {recursive: true});

	// Load dependency configuration early
	debug('Loading dependency configuration');
	const depConfigPath = await getDependencyConfigPath();
	const depConfig = JSON.parse(await fs.readFile(depConfigPath, 'utf8')) as DependencyConfig;
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
		author: author || '',
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

		if (t.workspaces) {
			finalPkg.workspaces = t.workspaces;
		}

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

	// Second pass: Collect and report actions
	const actions: Array<{
		type: 'ADD' | 'MODIFY' | 'MERGE' | 'CONFLICT' | 'SKIP' | 'DELETE';
		path: string;
	}> = [];
	const pendingOperations: Array<() => Promise<void>> = [];

	for (const t of templates) {
		debug('Collecting template files for: %s', t.name);

		// Handle physical files
		if (t.templateDir) {
			debug('Reading physical files from: %s', t.templateDir);
			const files = await getAllFiles(t.templateDir);
			for (const file of files) {
				let relativePath = path.relative(t.templateDir, file);
				let targetPath = path.join(projectDir, relativePath);

				// Skip seed files during update
				if (isUpdate && isSeedFile(relativePath)) {
					actions.push({type: 'SKIP', path: relativePath});
					continue;
				}

				if (!isFileRequired(relativePath, type)) {
					if (isUpdate && (await pathExists(targetPath))) {
						actions.push({type: 'DELETE', path: relativePath});
						pendingOperations.push(async () => {
							await fs.rm(targetPath, {force: true});
						});
					}
					continue;
				}

				if (relativePath.startsWith('_') && relativePath.endsWith('.config.ts')) {
					relativePath = relativePath.substring(1);
					targetPath = path.join(projectDir, relativePath);
				}

				if (relativePath === 'package.json') {
					continue;
				}

				// Specific logic for web-vanilla template index.ts/js
				const finalTargetPath = targetPath;
				const finalRelativePath = relativePath;

				const content = processContent(relativePath, await fs.readFile(file, 'utf8'), opts, addedDeps);
				const exists = await pathExists(finalTargetPath);

				if (isUpdate && exists) {
					const existingContent = await fs.readFile(finalTargetPath, 'utf8');
					if (existingContent.trim() !== content.trim()) {
						// For now, we assume it's a MERGE or MODIFY
						actions.push({type: 'MODIFY', path: finalRelativePath});
						pendingOperations.push(async () => {
							const result = await mergeFile(finalTargetPath, existingContent, content, log);
							if (result === 'merged') {
								log.info(`ℹ Merged: ${finalRelativePath}`);
							} else if (result === 'conflict') {
								log.warn(`⚠ Conflict: ${finalRelativePath}`);
							} else if (result === 'updated') {
								log.info(`✔ Updated: ${finalRelativePath}`);
							}
						});
					}
				} else if (!exists) {
					actions.push({type: 'ADD', path: finalRelativePath});
					pendingOperations.push(async () => {
						await fs.mkdir(path.dirname(finalTargetPath), {recursive: true});
						await fs.writeFile(finalTargetPath, content);
						const normalizedPath = finalRelativePath.split(path.sep).join('/');
						if (normalizedPath.startsWith('.husky/') && !normalizedPath.endsWith('/')) {
							await fs.chmod(finalTargetPath, 0o755);
						}
					});
				}
			}
		}

		// Handle programmatic files
		for (const file of t.files) {
			const targetPath = path.join(projectDir, file.path);
			if (isUpdate && isSeedFile(file.path)) {
				actions.push({type: 'SKIP', path: file.path});
				continue;
			}

			if (!isFileRequired(file.path, type)) {
				if (isUpdate && (await pathExists(targetPath))) {
					actions.push({type: 'DELETE', path: file.path});
					pendingOperations.push(async () => {
						await fs.rm(targetPath, {force: true});
					});
				}
				continue;
			}

			let content = typeof file.content === 'function' ? file.content() : file.content;
			content = processContent(file.path, content, opts, addedDeps);
			const exists = await pathExists(targetPath);

			if (isUpdate && exists) {
				const existingContent = await fs.readFile(targetPath, 'utf8');
				if (existingContent.trim() !== content.trim()) {
					actions.push({type: 'MODIFY', path: file.path});
					pendingOperations.push(async () => {
						const result = await mergeFile(targetPath, existingContent, content, log);
						if (result === 'merged') {
							log.info(`ℹ Merged: ${file.path}`);
						} else if (result === 'conflict') {
							log.warn(`⚠ Conflict: ${file.path}`);
						} else if (result === 'updated') {
							log.info(`✔ Updated: ${file.path}`);
						}
					});
				}
			} else if (!exists) {
				actions.push({type: 'ADD', path: file.path});
				pendingOperations.push(async () => {
					await fs.mkdir(path.dirname(targetPath), {recursive: true});
					await fs.writeFile(targetPath, content);
				});
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
		const workspacePath = path.join(projectDir, 'pnpm-workspace.yaml');
		const workspaceExists = await pathExists(workspacePath);

		let workspaceChanged = true;
		if (workspaceExists) {
			const existingWorkspaceContent = await fs.readFile(workspacePath, 'utf8');
			workspaceChanged = existingWorkspaceContent.trim() !== workspaceYaml.trim();
		}

		if (workspaceChanged) {
			actions.push({
				type: workspaceExists ? 'MODIFY' : 'ADD',
				path: 'pnpm-workspace.yaml',
			});
			pendingOperations.push(async () => {
				await fs.writeFile(workspacePath, workspaceYaml);
			});
		}
		delete finalPkg.workspaces;

		for (const key of Object.keys(finalPkg.scripts)) {
			const value = finalPkg.scripts[key];
			if (typeof value === 'string' && value.includes('--workspaces')) {
				finalPkg.scripts[key] = value.replace(' run ', ' -r run ').replace(' --workspaces', '');
			}
		}
	}

	// Always update package.json
	const newPkgContent = JSON.stringify(finalPkg, null, '\t');
	let pkgChanged = true;
	if (isUpdate && (await pathExists(pkgPath))) {
		const existingPkgContent = await fs.readFile(pkgPath, 'utf8');
		pkgChanged = existingPkgContent.trim() !== newPkgContent.trim();
	}

	if (pkgChanged) {
		if (isUpdate) {
			actions.push({type: 'MODIFY', path: 'package.json'});
		} else {
			actions.push({type: 'ADD', path: 'package.json'});
		}
		pendingOperations.push(async () => {
			debug('Writing final consolidated package.json to: %s', pkgPath);
			await fs.writeFile(pkgPath, newPkgContent);
		});
	}

	// If update, show summary and ask for confirmation
	if (isUpdate && actions.length > 0 && process.env.NODE_ENV !== 'test') {
		const summary = actions
			.filter((a) => a.type !== 'SKIP')
			.map((a) => `  ${a.type.padEnd(8)} ${a.path}`)
			.join('\n');

		if (summary) {
			const relativeProjectDir = path.relative(process.cwd(), projectDir) || '.';
			p.note(summary, `Planned changes in ${relativeProjectDir}:`);

			const confirm = await p.confirm({
				message: 'Do you want to apply these changes?',
				initialValue: true,
			});

			if (p.isCancel(confirm) || !confirm) {
				p.cancel('Update cancelled.');
				process.exit(0);
			}
		} else {
			log.info('No changes detected.');
		}
	}

	// Apply pending operations
	for (const op of pendingOperations) {
		await op();
	}

	// Initialize Git
	const stdio = debug.enabled ? 'inherit' : 'pipe';
	const isGit = await pathExists(path.join(projectDir, '.git'));
	if (!isGit) {
		debug('Initializing Git repository');
		try {
			debug('Executing: git init');
			await execa('git', ['init'], {
				cwd: projectDir,
				stdio,
				preferLocal: true,
			});
			log.success('Initialized Git repository (git init).');
		} catch (e: any) {
			debug('Failed to initialize Git: %O', e);
			const detail = e.stdout || e.stderr ? `\n\nOutput:\n${e.stdout}\n${e.stderr}` : '';
			log.error(`Failed to initialize Git: ${e.message}${detail}`);
		}
	}

	// GitHub Integration
	if (opts.createGithubRepository && !isUpdate) {
		debug('Creating GitHub repository');
		try {
			debug('Executing: gh repo create %s --public --source=. --remote=origin', projectName);
			await execa('gh', ['repo', 'create', projectName, '--public', '--source=.', '--remote=origin'], {
				cwd: projectDir,
				stdio,
				preferLocal: true,
			});
			log.success('Created GitHub repository (gh repo create).');
		} catch (e: any) {
			debug('Failed to create GitHub repository: %O', e);
			const detail = e.stdout || e.stderr ? `\n\nOutput:\n${e.stdout}\n${e.stderr}` : '';
			log.warn(`Failed to create GitHub repository: ${e.message}${detail}\nEnsure "gh" CLI is installed and authenticated.`);
		}
	}

	// Post-scaffolding actions
	if (opts.installDependencies) {
		debug('Installing dependencies using %s', pm);
		const s = spinner();
		s.start(`Installing dependencies using ${pm}...`);
		try {
			debug('Executing: %s install', pm);
			await execa(pm, ['install'], {
				cwd: projectDir,
				stdio,
				preferLocal: true,
			});
			s.stop(`\x1b[1G\x1b[2K\x1b[32m◆\x1b[39m  Dependencies installed (${pm} install).`);
		} catch (e: any) {
			debug('Failed to install dependencies: %O', e);
			s.stop('Failed to install dependencies.');
			const detail = e.stdout || e.stderr ? `\n\nOutput:\n${e.stdout}\n${e.stderr}` : '';
			log.error(`${e.message}${detail}`);
			throw new Error(`Failed to install dependencies: ${e.message}${detail}`);
		}
	}

	if (opts.build && finalPkg.scripts.ci) {
		debug('Running CI script');
		const s = spinner();

		if (finalPkg.scripts.format) {
			s.start(`Formatting files with oxfmt (${pm} run format)...`);
			try {
				debug('Executing: %s run format', pm);
				await execa(pm, ['run', 'format'], {
					cwd: projectDir,
					stdio,
					preferLocal: true,
				});
				s.stop(`\x1b[1G\x1b[2K\x1b[32m◆\x1b[39m  Files formatted (${pm} run format).`);
			} catch (e: any) {
				debug('Failed to format files: %O', e);
				s.stop('Failed to format files.');
				const detail = e.stdout || e.stderr ? `\n\nOutput:\n${e.stdout}\n${e.stderr}` : '';
				log.error(`${e.message}${detail}`);
			}
		}

		s.start(`Running CI script (lint, build, test) (${pm} run ci)...`);
		try {
			debug('Executing: %s run ci', pm);
			await execa(pm, ['run', 'ci'], {
				cwd: projectDir,
				stdio,
				preferLocal: true,
			});
			s.stop(`\x1b[1G\x1b[2K\x1b[32m◆\x1b[39m  CI script completed (${pm} run ci).`);
		} catch (e: any) {
			debug('Failed to run CI script: %O', e);
			s.stop('Failed to run CI script.');
			const detail = e.stdout || e.stderr ? `\n\nOutput:\n${e.stdout}\n${e.stderr}` : '';
			log.error(`${e.message}${detail}`);
			throw new Error(`Failed to run CI script: ${e.message}${detail}`);
		}
	}

	log.success(`Project "${projectName}" ${isUpdate ? 'updated' : 'scaffolded'} successfully in ${projectDir}`);
	showSummary(opts, pm, isProgress);
};

function showSummary(opts: ProjectOptions, pm: string, isProgress: boolean) {
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

	showNote([...summary, ...commands.map((c) => `  ${c}`)].join('\n'), 'Project ready', isProgress);
}
