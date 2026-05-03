import path from 'node:path';
import fs from 'node:fs/promises';
import {type ProjectOptions, type TemplateDefinition, type DependencyConfig} from '#shared/types.js';
import {execa} from 'execa';
import * as prompts from '@clack/prompts';
import debugLib from 'debug';
import {getAllFiles, isSeedFile, mergeFile, mergePackageJson, processContent} from '#shared/file.js';
import {getProjectTemplates} from '#templates/registry.js';

const debug = debugLib('create-template-project:generator');
const moduleDir = import.meta.dirname;

const pathExists = async (filePath: string): Promise<boolean> => {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
};

const getDependencyConfigPath = async (): Promise<string> => {
	const sourcePath = path.resolve(moduleDir, '../config/dependencies.json');
	const distPath = path.resolve(moduleDir, 'config/dependencies.json');
	return (await pathExists(distPath)) ? distPath : sourcePath;
};

const getLog = (
	progress: boolean,
): {
	info: (msg: string) => void;
	success: (msg: string) => void;
	warn: (msg: string) => void;
	error: (msg: string) => void;
} => ({
	info: (msg: string): void => {
		if (progress) {
			prompts.log.info(msg);
		}
	},
	success: (msg: string): void => {
		if (progress) {
			prompts.log.success(msg);
		}
	},
	warn: (msg: string): void => {
		prompts.log.warn(msg);
	},
	error: (msg: string): void => {
		prompts.log.error(msg);
	},
});

const getSpinner = (progress: boolean): {start: (msg: string) => void; stop: (msg: string) => void} => {
	const s = prompts.spinner();
	return {
		start: (msg: string): void => {
			if (progress) {
				s.start(msg);
			}
		},
		stop: (msg: string): void => {
			if (progress) {
				s.stop(msg);
			}
		},
	};
};

const isFileRequired = (relativePath: string, type: string): boolean => {
	if (relativePath === 'vitest.config.ts') {
		return !['cli', 'web-vanilla', 'web-app', 'web-fullstack'].includes(type);
	}
	return true;
};

type Action = {
	type: 'ADD' | 'MODIFY' | 'MERGE' | 'CONFLICT' | 'SKIP' | 'DELETE' | 'UPDATED';
	path: string;
	reason?: string;
	recommendedAction?: string;
};

type GeneratorState = {
	gitInitialized: boolean;
	githubCreated: boolean;
	githubSkipped: boolean;
	githubError: string;
	depsInstalled: boolean;
	depsSkipped: boolean;
	ciRun: boolean;
	ciSkipped: boolean;
};

type PlannedDiff = {
	path: string;
	before: string;
	after: string;
};

const buildSimpleUnifiedDiff = (filePath: string, before: string, after: string): string => {
	const beforeLines = before.split('\n');
	const afterLines = after.split('\n');
	const diffLines = [`--- a/${filePath}`, `+++ b/${filePath}`, '@@'];
	const max = Math.max(beforeLines.length, afterLines.length);
	for (let i = 0; i < max; i += 1) {
		const oldLine = i < beforeLines.length ? beforeLines[i] : undefined;
		const newLine = i < afterLines.length ? afterLines[i] : undefined;
		if (oldLine === newLine) {
			diffLines.push(` ${oldLine ?? ''}`);
			continue;
		}
		if (oldLine !== undefined) {
			diffLines.push(`-${oldLine}`);
		}
		if (newLine !== undefined) {
			diffLines.push(`+${newLine}`);
		}
	}
	return diffLines.join('\n');
};

type PackageJsonShape = {
	name: string;
	version: string;
	private: boolean;
	description: string;
	keywords: string[];
	homepage: string;
	bugs: {url: string};
	license: string;
	author: string;
	repository: {type: string; url: string};
	type: 'module';
	'create-template-project': {template: ProjectOptions['template']};
	scripts: Record<string, string>;
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
	workspaces?: string[];
};

type ExistingProjectPackage = Partial<PackageJsonShape> & {
	'create-template-project'?: {template?: ProjectOptions['template']};
};

type TemplatePackageJson = {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	[key: string]: unknown;
};

// eslint-disable-next-line prefer-const -- initialized after helper declaration order
let getTemplateArchitectureSection: (template: string) => string[];
// eslint-disable-next-line prefer-const -- initialized after helper declaration order
let generateGeneratedMd: (
	projectDir: string,
	opts: ProjectOptions,
	pm: string,
	states: GeneratorState,
	isUpdate: boolean,
	status: {hasErrors: boolean; hasWarnings: boolean; errorMessages: string[]},
	actions: {type: string; path: string; reason?: string; recommendedAction?: string}[],
) => Promise<void>;

const isTemplateType = (value: string): value is ProjectOptions['template'] =>
	value === 'cli' || value === 'web-vanilla' || value === 'web-app' || value === 'web-fullstack';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parseStringRecord = (value: unknown): Record<string, string> => {
	if (!isRecord(value)) {
		return {};
	}

	const out: Record<string, string> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === 'string') {
			out[key] = entry;
		}
	}
	return out;
};

const parseDependencyConfig = (raw: string): DependencyConfig => {
	const parsed = JSON.parse(raw) as unknown;
	if (!isRecord(parsed) || !isRecord(parsed.dependencies)) {
		throw new Error('Invalid dependency configuration file format.');
	}

	const dependencies: DependencyConfig['dependencies'] = {};
	for (const [name, value] of Object.entries(parsed.dependencies)) {
		if (!isRecord(value)) {
			continue;
		}

		const {version, description} = value;
		if (typeof version === 'string' && typeof description === 'string') {
			dependencies[name] = {version, description};
		}
	}

	return {dependencies};
};

const parseExistingProjectPackage = (raw: string): ExistingProjectPackage => {
	const parsed = JSON.parse(raw) as unknown;
	if (!isRecord(parsed)) {
		return {};
	}

	const createTemplateProject = isRecord(parsed['create-template-project']) ? parsed['create-template-project'] : undefined;
	const template = createTemplateProject ? createTemplateProject.template : undefined;

	return {
		...parsed,
		scripts: parseStringRecord(parsed.scripts),
		dependencies: parseStringRecord(parsed.dependencies),
		devDependencies: parseStringRecord(parsed.devDependencies),
		'create-template-project': typeof template === 'string' && isTemplateType(template) ? {template} : undefined,
	};
};

const parseTemplatePackageJson = (raw: string): TemplatePackageJson => {
	const parsed = JSON.parse(raw) as unknown;
	if (!isRecord(parsed)) {
		return {};
	}

	return {
		...parsed,
		dependencies: parseStringRecord(parsed.dependencies),
		devDependencies: parseStringRecord(parsed.devDependencies),
	};
};

const toErrorDetail = (error: unknown): {message: string; detail: string} => {
	if (error instanceof Error) {
		const withOutput = error as Error & {stdout?: string; stderr?: string};
		const stdout = withOutput.stdout ?? '';
		const stderr = withOutput.stderr ?? '';
		const detail = stdout.length > 0 || stderr.length > 0 ? `\n\nOutput:\n${stdout}\n${stderr}` : '';
		return {message: error.message, detail};
	}
	return {message: String(error), detail: ''};
};

export const generateProject = async (opts: ProjectOptions): Promise<void> => {
	const {template: type, projectName, author, githubUsername, directory, update, progress} = opts;
	const isProgress = progress;
	const log = getLog(isProgress);
	const spinner = (): ReturnType<typeof getSpinner> => getSpinner(isProgress);
	const projectDir = directory;
	debug('Project generation started for: %s', projectName);
	debug('Options: %O', opts);
	debug('Project directory: %s', projectDir);

	const isUpdate = update;

	if ((await pathExists(projectDir)) && !isUpdate) {
		throw new Error(`Directory "${projectDir}" already exists. Use the "update" command to update.`);
	}

	debug('Applying template: base');
	debug('Applying template: %s', type);
	const templates: TemplateDefinition[] = getProjectTemplates(opts);

	debug('Ensuring directory exists: %s', projectDir);
	await fs.mkdir(projectDir, {recursive: true});

	// Load dependency configuration early
	debug('Loading dependency configuration');
	const depConfigPath = await getDependencyConfigPath();
	const depConfig = parseDependencyConfig(await fs.readFile(depConfigPath, 'utf8'));
	const addedDeps: {name: string; description: string}[] = [];

	const resolveDeps = (deps: Record<string, string> = {}): void => {
		for (const dep of Object.keys(deps)) {
			if (Object.hasOwn(depConfig.dependencies, dep)) {
				const config = depConfig.dependencies[dep];
				deps[dep] = config.version;
				addedDeps.push({name: dep, description: config.description});
			} else {
				log.warn(`Dependency "${dep}" not found in central configuration. Using empty version.`);
				debug(`Dependency "${dep}" missing in config`);
			}
		}
	};

	// Final consolidated data
	let finalPkg: PackageJsonShape = {
		name: projectName,
		version: '0.1.0',
		private: true,
		description: opts.description ?? 'TODO: Add project description',
		keywords: opts.keywords !== undefined ? opts.keywords.split(',').map((k) => k.trim()) : ['TODO: Add keywords'],
		homepage: `https://github.com/${githubUsername}/${projectName}#readme`,
		bugs: {
			url: `https://github.com/${githubUsername}/${projectName}/issues`,
		},
		license: 'MIT',
		author,
		repository: {
			type: 'git',
			url: `https://github.com/${githubUsername}/${projectName}.git`,
		},
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
		const existingPkg = parseExistingProjectPackage(await fs.readFile(pkgPath, 'utf8'));

		if (!existingPkg['create-template-project']) {
			throw new Error(
				`No "create-template-project" configuration found in ${pkgPath}. The update command can only be used on projects created with this tool.`,
			);
		}

		finalPkg = {
			...finalPkg,
			...existingPkg,
			'create-template-project': {
				...existingPkg['create-template-project'],
				template: type,
			},
			scripts: {...existingPkg.scripts},
			dependencies: {...existingPkg.dependencies},
			devDependencies: {...existingPkg.devDependencies},
		}; // Keep existing name/version/type if they exist
		debug('Loaded existing package.json: %O', finalPkg);
	}

	const templatePackageParts = await Promise.all(
		templates.map(async (template): Promise<TemplatePackageJson | undefined> => {
			if (template.templateDir === undefined) {
				return undefined;
			}

			const templatePkgPath = path.join(template.templateDir, 'package.json');
			if (!(await pathExists(templatePkgPath))) {
				return undefined;
			}

			const templatePkgContent = await fs.readFile(templatePkgPath, 'utf8');
			const processedTemplatePkgContent = processContent('package.json', templatePkgContent, opts, addedDeps);
			return parseTemplatePackageJson(processedTemplatePkgContent);
		}),
	);

	// First pass: Resolve all dependencies and scripts from all templates
	for (const [index, t] of templates.entries()) {
		debug('Collecting dependencies and scripts from template: %s', t.name);
		const templateDeps = {...t.dependencies};
		const templateDevDeps = {...t.devDependencies};
		resolveDeps(templateDeps);
		resolveDeps(templateDevDeps);

		Object.assign(finalPkg.scripts, t.scripts);
		Object.assign(finalPkg.dependencies, templateDeps);
		Object.assign(finalPkg.devDependencies, templateDevDeps);

		if (t.workspaces !== undefined) {
			finalPkg.workspaces = t.workspaces;
		}

		const pkgPart = templatePackageParts[index];
		if (pkgPart !== undefined) {
			resolveDeps(pkgPart.dependencies);
			resolveDeps(pkgPart.devDependencies);
			mergePackageJson(finalPkg, pkgPart);
		}
	}

	// Second pass: Collect and report actions
	const actions: Action[] = [];
	const pendingOperations: (() => Promise<void>)[] = [];
	const plannedDiffs: PlannedDiff[] = [];

	/* eslint-disable eslint/no-await-in-loop -- file planning is intentionally sequential to keep action ordering deterministic */
	for (const t of templates) {
		debug('Collecting template files for: %s', t.name);

		// Handle physical files
		if (t.templateDir !== undefined) {
			debug('Reading physical files from: %s', t.templateDir);
			const files = await getAllFiles(t.templateDir);
			for (const file of files) {
				let relativePath = path.relative(t.templateDir, file);
				let targetPath = path.join(projectDir, relativePath);

				// Skip seed files during update
				if (isUpdate && isSeedFile(relativePath)) {
					actions.push({
						type: 'SKIP',
						path: relativePath,
						reason: 'Seed file - skipped during update to preserve manual changes',
					});
					continue;
				}

				if (!isFileRequired(relativePath, type)) {
					if (isUpdate && (await pathExists(targetPath))) {
						actions.push({
							type: 'DELETE',
							path: relativePath,
							reason: 'File no longer required for this template type',
						});
						pendingOperations.push(async () => {
							await fs.rm(targetPath, {force: true});
						});
					}
					continue;
				}

				if (relativePath.startsWith('_') && relativePath.endsWith('.config.ts')) {
					relativePath = relativePath.slice(1);
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
						plannedDiffs.push({path: finalRelativePath, before: existingContent, after: content});
						// For now, we assume it's a MERGE or MODIFY
						const action: (typeof actions)[0] = {
							type: 'MODIFY',
							path: finalRelativePath,
							reason: 'Template tooling or configuration update',
						};
						actions.push(action);
						pendingOperations.push(async () => {
							const result = await mergeFile(finalTargetPath, existingContent, content, log);
							if (result === 'merged') {
								action.type = 'MERGE';
								action.reason = 'Merged template updates with your manual changes';
								action.recommendedAction = 'Review changes for correct integration';
								log.info(`ℹ Merged: ${finalRelativePath}`);
							} else if (result === 'conflict') {
								action.type = 'CONFLICT';
								action.reason = 'Conflicting changes between template and your code';
								action.recommendedAction = 'Resolve git conflict markers in this file';
								log.warn(`⚠ Conflict: ${finalRelativePath}`);
							} else if (result === 'updated') {
								action.type = 'UPDATED';
								action.reason = 'File was updated to the latest template version';
								log.info(`✔ Updated: ${finalRelativePath}`);
							}
						});
					}
				} else if (!exists) {
					plannedDiffs.push({path: finalRelativePath, before: '', after: content});
					actions.push({
						type: 'ADD',
						path: finalRelativePath,
						reason: 'New template file added',
					});
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
				actions.push({
					type: 'SKIP',
					path: file.path,
					reason: 'Seed file - skipped during update to preserve manual changes',
				});
				continue;
			}

			if (!isFileRequired(file.path, type)) {
				if (isUpdate && (await pathExists(targetPath))) {
					actions.push({
						type: 'DELETE',
						path: file.path,
						reason: 'File no longer required for this template type',
					});
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
					plannedDiffs.push({path: file.path, before: existingContent, after: content});
					const action: (typeof actions)[0] = {
						type: 'MODIFY',
						path: file.path,
						reason: 'Template configuration update',
					};
					actions.push(action);
					pendingOperations.push(async () => {
						const result = await mergeFile(targetPath, existingContent, content, log);
						if (result === 'merged') {
							action.type = 'MERGE';
							action.reason = 'Merged template updates with your manual changes';
							action.recommendedAction = 'Review changes for correct integration';
							log.info(`ℹ Merged: ${file.path}`);
						} else if (result === 'conflict') {
							action.type = 'CONFLICT';
							action.reason = 'Conflicting changes between template and your code';
							action.recommendedAction = 'Resolve git conflict markers in this file';
							log.warn(`⚠ Conflict: ${file.path}`);
						} else if (result === 'updated') {
							action.type = 'UPDATED';
							action.reason = 'File was updated to the latest template version';
							log.info(`✔ Updated: ${file.path}`);
						}
					});
				}
			} else if (!exists) {
				plannedDiffs.push({path: file.path, before: '', after: content});
				actions.push({
					type: 'ADD',
					path: file.path,
					reason: 'New template file added',
				});
				pendingOperations.push(async () => {
					await fs.mkdir(path.dirname(targetPath), {recursive: true});
					await fs.writeFile(targetPath, content);
				});
			}
		}
	}
	/* eslint-enable eslint/no-await-in-loop */

	// Apply final programmatic overrides
	const pm = opts.packageManager;

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
			const oldWorkspaceContent = workspaceExists ? await fs.readFile(workspacePath, 'utf8') : '';
			plannedDiffs.push({path: 'pnpm-workspace.yaml', before: oldWorkspaceContent, after: workspaceYaml});
			actions.push({
				type: workspaceExists ? 'MODIFY' : 'ADD',
				path: 'pnpm-workspace.yaml',
				reason: 'Updated workspace configuration for pnpm',
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
		const oldPkgContent = isUpdate && (await pathExists(pkgPath)) ? await fs.readFile(pkgPath, 'utf8') : '';
		plannedDiffs.push({path: 'package.json', before: oldPkgContent, after: newPkgContent});
		if (isUpdate) {
			actions.push({
				type: 'MODIFY',
				path: 'package.json',
				reason: 'Updated dependencies and scripts to match latest template',
			});
		} else {
			actions.push({type: 'ADD', path: 'package.json', reason: 'Initial project configuration'});
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
			prompts.note(summary, `Planned changes in ${relativeProjectDir}:`);

			let confirmed = false;
			/* eslint-disable eslint/no-await-in-loop -- prompt loop is intentionally sequential */
			while (!confirmed) {
				const action = await prompts.select({
					message: 'Choose next step:',
					options: [
						{label: 'Show diff', value: 'show-diff'},
						{label: 'Apply changes', value: 'apply'},
						{label: 'Cancel update', value: 'cancel'},
					],
				});
				if (prompts.isCancel(action) || action === 'cancel') {
					prompts.cancel('Update cancelled.');
					process.exit(0);
				}
				if (action === 'show-diff') {
					for (const entry of plannedDiffs) {
						const diff = buildSimpleUnifiedDiff(entry.path, entry.before, entry.after);
						prompts.note(diff, `Diff preview: ${entry.path}`);
					}
					continue;
				}
				confirmed = true;
			}
			/* eslint-enable eslint/no-await-in-loop */
		} else {
			log.info('No changes detected.');
		}
	}

	// Apply pending operations
	await pendingOperations.reduce(async (previous, operation) => {
		await previous;
		await operation();
	}, Promise.resolve());

	const states: GeneratorState = {
		gitInitialized: false,
		githubCreated: false,
		githubSkipped: !opts.createGithubRepository || isUpdate,
		githubError: '',
		depsInstalled: false,
		depsSkipped: !opts.build,
		ciRun: false,
		ciSkipped: !opts.build || !finalPkg.scripts.ci,
	};

	// Initialize Git
	const stdio = debug.enabled ? 'inherit' : 'pipe';
	const isGit = await pathExists(path.join(projectDir, '.git'));
	if (!isGit) {
		debug('Initializing Git repository');
		try {
			debug('Executing: git init --initial-branch=main');
			await execa('git', ['init', '--initial-branch=main'], {
				cwd: projectDir,
				stdio,
				preferLocal: true,
			});
			log.success('Initialized Git repository (main branch).');
			states.gitInitialized = true;
		} catch (error: unknown) {
			debug('Failed to initialize Git: %O', error);
			const {message, detail} = toErrorDetail(error);
			log.error(`Failed to initialize Git: ${message}${detail}`);
		}
	} else {
		states.gitInitialized = true; // Already initialized
	}

	// Post-scaffolding actions
	if (opts.build) {
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
			states.depsInstalled = true;
		} catch (error: unknown) {
			debug('Failed to install dependencies: %O', error);
			s.stop('Failed to install dependencies.');
			const {message, detail} = toErrorDetail(error);
			log.error(`${message}${detail}`);
			throw new Error(`Failed to install dependencies: ${message}${detail}`, {cause: error});
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
			} catch (error: unknown) {
				debug('Failed to format files: %O', error);
				s.stop('Failed to format files.');
				const {message, detail} = toErrorDetail(error);
				log.error(`${message}${detail}`);
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
			states.ciRun = true;
		} catch (error: unknown) {
			debug('Failed to run CI script: %O', error);
			s.stop('Failed to run CI script.');
			const {message, detail} = toErrorDetail(error);
			log.error(`${message}${detail}`);
			throw new Error(`Failed to run CI script: ${message}${detail}`, {cause: error});
		}
	}

	// GitHub Integration (Create, Commit, Push)
	if (opts.createGithubRepository && !isUpdate) {
		debug('Creating and pushing GitHub repository');
		const s = spinner();
		s.start('Creating and pushing GitHub repository...');
		try {
			debug('Executing: git add .');
			await execa('git', ['add', '.'], {
				cwd: projectDir,
				stdio,
				preferLocal: true,
			});

			debug('Executing: git commit -m "chore: initial scaffold"');
			await execa('git', ['commit', '-m', 'chore: initial scaffold'], {
				cwd: projectDir,
				stdio,
				preferLocal: true,
			});

			debug('Executing: gh repo create %s --public --source=. --remote=origin --push', projectName);
			await execa('gh', ['repo', 'create', projectName, '--public', '--source=.', '--remote=origin', '--push'], {
				cwd: projectDir,
				stdio,
				preferLocal: true,
			});
			s.stop(`\x1b[1G\x1b[2K\x1b[32m◆\x1b[39m  Created GitHub repository and pushed initial commit.`);
			states.githubCreated = true;
		} catch (error: unknown) {
			debug('Failed to create/push GitHub repository: %O', error);
			s.stop('Failed to create/push GitHub repository.');
			const {message, detail} = toErrorDetail(error);
			log.warn(`Failed to create/push GitHub repository: ${message}${detail}\nEnsure "gh" CLI is installed and authenticated.`);
			states.githubError = message;
		}
	}

	let hasWarnings = false;
	const errorMessages: string[] = [];

	if (states.githubError) {
		hasWarnings = true;
		errorMessages.push(`GitHub repository creation failed: ${states.githubError}`);
	}

	const hasErrors = errorMessages.some((message) => message.startsWith('ERROR:'));

	await generateGeneratedMd(
		projectDir,
		opts,
		pm,
		states,
		isUpdate,
		{
			hasErrors,
			hasWarnings,
			errorMessages,
		},
		actions,
	);

	const successMsg = `Project "${projectName}" ${isUpdate ? 'updated' : 'scaffolded'} successfully in ${projectDir}. A detailed setup guide has been generated at GENERATED.md`;
	if (hasErrors) {
		log.error(`${successMsg} (completed with errors)`);
	} else if (hasWarnings) {
		log.warn(`${successMsg} (completed with warnings)`);
	} else {
		log.success(successMsg);
	}
};

generateGeneratedMd = async (
	projectDir: string,
	opts: ProjectOptions,
	pm: string,
	states: GeneratorState,
	isUpdate: boolean,
	status: {hasErrors: boolean; hasWarnings: boolean; errorMessages: string[]},
	actions: {type: string; path: string; reason?: string; recommendedAction?: string}[],
): Promise<void> => {
	const statusBadge = status.hasErrors
		? '🔴 **Completed with Errors**'
		: status.hasWarnings
			? '🟡 **Completed with Warnings**'
			: '🟢 **Successfully Completed**';

	const skippedStepInstructions: string[] = [
		...(states.depsSkipped ? [`- [ ] **Install dependencies manually:** Run \`${pm} install\` from the project root.`] : []),
		...(states.githubSkipped
			? [
					`- [ ] **Create and push GitHub repository manually:** Verify GitHub CLI auth with \`gh auth status\`, then run \`gh repo create ${opts.projectName} --public --source=. --remote=origin --push\`.`,
				]
			: []),
		...(states.ciSkipped ? [`- [ ] **Run CI checks manually:** After dependencies are installed, run \`${pm} run ci\`.`] : []),
	];

	const md = [
		`# 🚀 Project Setup Guide: ${opts.projectName}`,
		'',
		`Welcome to your newly ${isUpdate ? 'updated' : 'generated'} **${opts.template}** project! This document outlines what was scaffolded, the automated steps already completed, and the remaining manual adjustments required to finalize your setup.`,
		'',
		`**Status:** ${statusBadge}`,
		'',
		...(status.errorMessages.length > 0 ? ['### ⚠️ Issues Encountered', ...status.errorMessages.map((msg) => `- ${msg}`), ''] : []),
		'## 📦 What Was Generated',
		`* **Project Name:** \`${opts.projectName}\``,
		`* **Template Used:** \`${opts.template}\``,
		`* **Package Manager:** \`${pm}\``,
		'',
		'---',
		'',
		'## 📋 Initialization Checklist',
		isUpdate ? 'The project was updated with the latest template changes:' : 'The following tasks were executed during the generation process:',
		`- [x] Scaffold project files and directories`,
		`- [x] Configure \`package.json\` with appropriate dependencies`,
		`- [${states.depsInstalled ? 'x' : ' '}] Install dependencies using \`${pm}\`${states.depsSkipped ? ' *(Skipped)*' : ''}`,
		`- [${states.gitInitialized ? 'x' : ' '}] Initialize Git repository (main branch)`,
		`- [${states.githubCreated ? 'x' : ' '}] Create and push GitHub repository${states.githubSkipped ? ' *(Skipped)*' : states.githubError ? ' *(Failed)*' : ''}`,
		`- [${states.ciRun ? 'x' : ' '}] Run initial CI pipeline (lint, build, test)${states.ciSkipped ? ' *(Skipped)*' : ''}`,
		'',
		...(skippedStepInstructions.length > 0
			? [
					'## ⏭️ Complete Skipped Steps Manually',
					'Some initialization steps were marked as *(Skipped)*. Use the guidance below to complete them yourself:',
					...skippedStepInstructions,
					'',
				]
			: []),
		...(isUpdate
			? [
					'### 🛠️ Upgrade Details',
					'The following files were affected by this update:',
					'',
					'| File Path | Action | Reason | Next Steps |',
					'| :--- | :--- | :--- | :--- |',
					...actions
						.filter((a) => a.type !== 'SKIP')
						.map((a) => {
							const actionIcon =
								{
									ADD: '➕ ADD',
									MODIFY: '📝 MODIFY',
									MERGE: '🔀 MERGE',
									CONFLICT: '🔥 CONFLICT',
									DELETE: '🗑️ DELETE',
									UPDATED: '✨ UPDATED',
								}[a.type] ?? a.type;
							return `| \`${a.path}\` | ${actionIcon} | ${a.reason ?? '-'} | ${a.recommendedAction ?? (a.type === 'CONFLICT' ? '**Resolve conflicts**' : 'Review changes')} |`;
						}),
					'',
				]
			: []),
		'---',
		'',
		'## 🛠️ Manual Adjustments Needed',
		'To complete your project setup, please review and manually update the following:',
		'- [ ] **`LICENSE`**: Verify the copyright year and author name.',
		'- [ ] **`package.json`**: Review the description, keywords, author, and repository links.',
		'- [ ] **`README.md`**: Update with project-specific instructions, architecture details, and contribution guidelines.',
		'- [ ] **`.gitignore`**: Note that there is a **`# Custom`** section at the end of the file for your own ignores.',
		'',
		'---',
		'',
		'## 💡 Next Steps',
		'1. Review the generated codebase to familiarize yourself with the structure.',
		`2. Start the development server using \`${pm} run dev\`.`,
		'3. Make your first commit and push to your remote repository.',
		'',
		'---',
		'',
		'## 💻 Available Commands',
		`You can run these commands from the project root using \`${pm} run <command>\`:`,
		'',
		'| Command | Description |',
		'| :--- | :--- |',
		'| `dev` | Starts the development server |',
		'| `build` | Builds the project for production |',
		'| `test` | Runs the unit test suite (Vitest) |',
		'| `lint` | Lints and formats the codebase |',
		'| `ci` | Runs lint, build, and test (used by CI/CD) |',
		'',
		'---',
		'',
		...getTemplateArchitectureSection(opts.template),
		'',
		'---',
		'',
		'## 🧪 Testing Strategy',
		'',
		'### Unit Testing (Vitest)',
		'This project is pre-configured with **Vitest** for blazing-fast unit testing and coverage reporting.',
		`- **Where to put tests**: Create files with the \`.test.ts\` or \`.spec.ts\` extension next to your source files (e.g., \`src/main.test.ts\`).`,
		`- **How to run**: \`${pm} run test\``,
		`- **Watch mode**: \`${pm} exec vitest\` to automatically re-run tests on file changes.`,
		`- **Coverage**: Coverage is generated automatically during the test run. Aim for high coverage on core logic!`,
		'',
		'### End-to-End (E2E) Testing',
		"Currently, only unit tests are scaffolded by default. To enhance your project's reliability, we highly recommend adding E2E testing:",
		`- **For Web Apps**: Consider installing [Playwright](https://playwright.dev/) (\`${pm} create playwright\`) to simulate real user interactions in the browser.`,
		`- **For CLIs**: Consider using \`execa\` within your Vitest suite to invoke your compiled CLI binary and assert its \`stdout\`/\`stderr\` outputs.`,
		'',
		'---',
		'',
		'## 🐙 Key Git Commands',
		'Here are the most common Git operations you will use to manage your codebase:',
		'',
		'| Command | Description |',
		'| :--- | :--- |',
		'| `git status` | Check the current state of your working directory |',
		'| `git add .` | Stage all your changes for the next commit |',
		'| `git commit -m "feat: your feature"` | Create a new commit (following Conventional Commits) |',
		'| `git push` | Push your committed changes to the remote repository |',
		'| `git pull` | Fetch and merge changes from the remote repository |',
		'| `git checkout -b <branch>` | Create and switch to a new branch |',
		'',
		'---',
		'',
		'## 🐈 Key GitHub (`gh`) Commands',
		'The `gh` CLI provides powerful tools to interact with GitHub right from your terminal:',
		'',
		'| Command | Description |',
		'| :--- | :--- |',
		'| `gh repo view --web` | Open the repository in your default web browser |',
		'| `gh repo create <name> --public --source=. --remote=origin --push` | Create and push a new GitHub repository |',
		'| `gh pr create` | Create a new Pull Request |',
		'| `gh pr checkout <pr-number>` | Checkout a Pull Request branch locally |',
		'| `gh issue create` | Create a new Issue |',
		'| `gh issue list` | List all open Issues |',
		'| `gh repo delete <owner>/<repo> --yes` | Dangerously delete a repository completely (use with caution!) |',
		'',
		'---',
		'',
		'## 🚀 Creating a Release',
		'This project uses Conventional Commits and automated changelogs. To create a new release:',
		'1. **Run the release command:** `pnpm release`',
		'',
		'This single command will automatically run your CI suite, bump the version, generate a changelog, create a Git tag, push to GitHub, and create a GitHub release.',
		'',
		'**Note:** NPM publishing is disabled by default. See `CONTRIBUTING.md` for details on how to enable it.',

		'',
		'---',
		'',
		'<br>',
		'<p align="center"><i>This file was auto-generated by <b>create-template-project</b>.</i></p>',
	].join('\n');

	await fs.writeFile(path.join(projectDir, 'GENERATED.md'), md);
};

getTemplateArchitectureSection = (template: string): string[] => {
	switch (template) {
		case 'cli': {
			return [
				'## 🏗️ CLI Architecture',
				'This project uses `commander` for argument parsing and `@clack/prompts` for interactive CLI interfaces.',
				'',
				'### Source Files Generated',
				'- **`src/index.ts`**: The main execution entry point. Handles top-level errors and bootstraps the CLI application.',
				'- **`src/cli.ts`**: Parses command-line arguments and orchestrates your user prompts.',
				'',
				'### How to Enhance',
				'- Add new sub-commands directly in `src/cli.ts`.',
				'- Extract logic into a new `src/commands/` directory as your application scales.',
			];
		}
		case 'web-vanilla': {
			return [
				'## 🏗️ Web Vanilla Architecture',
				'A standalone, blazing fast web application scaffolded with Vite.',
				'',
				'### Source Files Generated',
				'- **`index.html`**: The main HTML entry point that loads your application scripts.',
				'- **`src/main.ts`**: The core TypeScript application logic where you can start adding DOM manipulation.',
				'',
				'### How to Enhance',
				'- Add new UI logic or Web Components inside the `src/` directory.',
				'- Create styling (`.css` or `.scss`) and import them directly into `main.ts`.',
			];
		}
		case 'web-app': {
			return [
				'## 🏗️ Web App Architecture',
				'A robust React SPA configured with MUI components and TanStack Query.',
				'',
				'### Source Files Generated',
				'- **`index.html`**: The HTML entry point hosting the React root element.',
				'- **`src/main.tsx`**: Bootstraps the React application and mounts all necessary providers (QueryClient, Theme).',
				'- **`src/App.tsx`**: The root application component. Start building your UI here.',
				'',
				'### How to Enhance',
				'- Add new components to a `src/components/` directory.',
				'- Set up React Router for client-side routing.',
				'- Manage complex global state with a store like Zustand if needed.',
			];
		}
		case 'web-fullstack': {
			return [
				'## 🏗️ Fullstack Monorepo Architecture',
				'A modern monorepo combining an Express server with a React client, seamlessly integrated using workspaces.',
				'',
				'### Source Files Generated',
				'- **`client/`**: The frontend React application (similar to the `web-app` template).',
				'- **`server/`**: The backend Express/Node application delivering API endpoints.',
				'',
				'### How to Enhance',
				'- Add new API routes in the `server` package.',
				'- Consume those routes in the `client` package via TanStack Query.',
				'- **Tip**: Create a `shared/` workspace package to share types across both frontend and backend for end-to-end type safety.',
			];
		}
		default: {
			return [];
		}
	}
};
