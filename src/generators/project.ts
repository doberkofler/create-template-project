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
		description: opts.description || 'TODO: Add project description',
		keywords: opts.keywords ? opts.keywords.split(',').map((k) => k.trim()) : ['TODO: Add keywords'],
		homepage: `https://github.com/${author}/${projectName}#readme`,
		bugs: {
			url: `https://github.com/${author}/${projectName}/issues`,
		},
		license: 'MIT',
		author: author || '',
		repository: {
			type: 'git',
			url: `https://github.com/${author}/${projectName}.git`,
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
		const existingPkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));

		if (!existingPkg['create-template-project']?.template) {
			throw new Error(
				`No "create-template-project" configuration found in ${pkgPath}. The update command can only be used on projects created with this tool.`,
			);
		}

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

	const states = {
		gitInitialized: false,
		githubCreated: false,
		githubSkipped: !opts.createGithubRepository || isUpdate,
		githubError: '',
		depsInstalled: false,
		depsSkipped: !opts.installDependencies,
		ciRun: false,
		ciSkipped: !opts.build || !finalPkg.scripts.ci,
	};

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
			states.gitInitialized = true;
		} catch (e: any) {
			debug('Failed to initialize Git: %O', e);
			const detail = e.stdout || e.stderr ? `\n\nOutput:\n${e.stdout}\n${e.stderr}` : '';
			log.error(`Failed to initialize Git: ${e.message}${detail}`);
		}
	} else {
		states.gitInitialized = true; // Already initialized
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
			states.githubCreated = true;
		} catch (e: any) {
			debug('Failed to create GitHub repository: %O', e);
			const detail = e.stdout || e.stderr ? `\n\nOutput:\n${e.stdout}\n${e.stderr}` : '';
			log.warn(`Failed to create GitHub repository: ${e.message}${detail}\nEnsure "gh" CLI is installed and authenticated.`);
			states.githubError = e.message;
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
			states.depsInstalled = true;
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
			states.ciRun = true;
		} catch (e: any) {
			debug('Failed to run CI script: %O', e);
			s.stop('Failed to run CI script.');
			const detail = e.stdout || e.stderr ? `\n\nOutput:\n${e.stdout}\n${e.stderr}` : '';
			log.error(`${e.message}${detail}`);
			throw new Error(`Failed to run CI script: ${e.message}${detail}`);
		}
	}

	let hasErrors = false;
	let hasWarnings = false;
	const errorMessages: string[] = [];

	if (states.githubError) {
		hasWarnings = true;
		errorMessages.push(`GitHub repository creation failed: ${states.githubError}`);
	}

	await generateGeneratedMd(projectDir, opts, pm, states, isUpdate, {
		hasErrors,
		hasWarnings,
		errorMessages,
	});

	const successMsg = `Project "${projectName}" ${isUpdate ? 'updated' : 'scaffolded'} successfully in ${projectDir}. A detailed setup guide has been generated at GENERATED.md`;
	if (hasErrors) {
		log.error(`${successMsg} (completed with errors)`);
	} else if (hasWarnings) {
		log.warn(`${successMsg} (completed with warnings)`);
	} else {
		log.success(successMsg);
	}
};

async function generateGeneratedMd(
	projectDir: string,
	opts: ProjectOptions,
	pm: string,
	states: any,
	isUpdate: boolean,
	status: {hasErrors: boolean; hasWarnings: boolean; errorMessages: string[]},
) {
	const statusBadge = status.hasErrors
		? '🔴 **Completed with Errors**'
		: status.hasWarnings
			? '🟡 **Completed with Warnings**'
			: '🟢 **Successfully Completed**';

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
		'The following tasks were executed during the generation process:',
		`- [x] Scaffold project files and directories`,
		`- [x] Configure \`package.json\` with appropriate dependencies`,
		`- [${states.depsInstalled ? 'x' : ' '}] Install dependencies using \`${pm}\`${states.depsSkipped ? ' *(Skipped)*' : ''}`,
		`- [${states.gitInitialized ? 'x' : ' '}] Initialize Git repository`,
		`- [${states.githubCreated ? 'x' : ' '}] Create GitHub repository${states.githubSkipped ? ' *(Skipped)*' : states.githubError ? ' *(Failed)*' : ''}`,
		`- [${states.ciRun ? 'x' : ' '}] Run initial CI pipeline (lint, build, test)${states.ciSkipped ? ' *(Skipped)*' : ''}`,
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
		'| `gh pr create` | Create a new Pull Request |',
		'| `gh pr checkout <pr-number>` | Checkout a Pull Request branch locally |',
		'| `gh issue create` | Create a new Issue |',
		'| `gh issue list` | List all open Issues |',
		'| `gh repo delete <owner>/<repo> --confirm` | Dangerously delete a repository completely (use with caution!) |',
		'',
		'---',
		'',
		'## 🚀 Creating a Release',
		'This project uses Conventional Commits and automated changelogs. To create a new release:',
		'1. **Verify build/tests:** `pnpm run ci`',
		'2. **Bump version:** `pnpm version <patch|minor|major> --no-git-tag-version`',
		'3. **Update changelog:** `pnpm run create-changelog`',
		'4. **Commit changes:** `git add . && git commit -m "chore(release): $(node -p \'require("./package.json").version\')"`',
		'5. **Tag & Push:** `git tag v$(node -p \'require("./package.json").version\') && git push && git push --tags`',
		'6. **Create GitHub Release:** `gh release create v$(node -p \'require("./package.json").version\') --generate-notes`',
		'7. **Publish (if applicable):** `pnpm publish`',
		'',
		'---',
		'',
		'## 🛠️ Manual Adjustments Needed',
		'To complete your project setup, please review and manually update the following:',
		'- [ ] **`LICENSE`**: Verify the copyright year and author name.',
		'- [ ] **`package.json`**: Review the description, keywords, author, and repository links.',
		'- [ ] **`README.md`**: Update with project-specific instructions, architecture details, and contribution guidelines.',
		'',
		'---',
		'',
		'## 💡 Next Steps',
		'1. Review the generated codebase to familiarize yourself with the structure.',
		`2. Start the development server using \`${pm} run dev\`.`,
		'3. Make your first commit and push to your remote repository.',
		'',
		'<br>',
		'<p align="center"><i>This file was auto-generated by <b>create-template-project</b>.</i></p>',
	].join('\n');

	await fs.writeFile(path.join(projectDir, 'GENERATED.md'), md);
}

function getTemplateArchitectureSection(template: string): string[] {
	switch (template) {
		case 'cli':
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
		case 'web-vanilla':
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
		case 'web-app':
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
		case 'web-fullstack':
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
		default:
			return [];
	}
}
