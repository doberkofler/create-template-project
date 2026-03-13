import {Command} from 'commander';
import * as p from '@clack/prompts';
import {ProjectOptions, ProjectOptionsSchema} from './types.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import debugLib from 'debug';

const pathExists = (p: string) =>
	fs
		.access(p)
		.then(() => true)
		.catch(() => false);

const debug = debugLib('create-template-project:cli');

export const parseArgs = async (): Promise<ProjectOptions> => {
	debug('Parsing CLI arguments: %O', process.argv);
	const program = new Command();
	if (process.env.NODE_ENV === 'test') {
		program.configureOutput({
			writeOut: () => {},
			writeErr: () => {},
		});
	}

	program
		.name('create-template-project')
		.exitOverride()
		.description('Scaffold a new project template')
		.version('0.1.0')
		.option('--debug', 'Enable debug output')
		.on('option:debug', () => {
			debugLib.enable('create-template-project:*');
		})
		.addHelpText(
			'after',
			`
Templates:
  cli         - Node.js CLI application with commander and cli-progress.
  webpage     - Standalone web page (modern HTML/JS).
  webapp      - Web application with TypeScript and an Express backend.
  fullstack   - Full-stack monorepo with Express server and React/MUI client.
`,
		);

	let commandResult: ProjectOptions | undefined;

	program
		.command('create')
		.description('Create a new project from a template')
		.option('-t, --template <type>', 'Template type (cli, webpage, webapp, fullstack)')
		.option('-n, --name <name>', 'Project name')
		.option('-p, --package-manager <pm>', 'Package manager (npm, pnpm, yarn)', 'npm')
		.option('--create-github-repository', 'Create GitHub project')
		.option('-d, --directory <path>', 'Output directory', '.')
		.option('--overwrite', 'Overwrite existing directory by removing it first', false)
		.option('--skip-build', 'Skip build tooling (disables bundling and uses raw source files)', false)
		.option('--install-dependencies', 'Install dependencies after scaffolding', false)
		.option('--build', 'Run the CI script (lint, build, test) after scaffolding', false)
		.option('--dev', 'Run the dev server after scaffolding', false)
		.option('--open', 'Open the browser after scaffolding', false)
		.option('--silent', 'Reduce console output', false)
		.action((opts) => {
			debug('Executing "create" command with options: %O', opts);
			if (opts.template === 'webapp' && opts.skipBuild) {
				p.log.error('The --skip-build option is not allowed for the "webapp" template.');
				process.exit(1);
			}
			commandResult = {
				...opts,
				update: false,
				template: opts.template as ProjectOptions['template'],
				projectName: opts.name,
				packageManager: opts.packageManager as ProjectOptions['packageManager'],
				directory: path.resolve(opts.directory),
				createGithubRepository: !!opts.createGithubRepository,
				overwrite: !!opts.overwrite,
				silent: !!opts.silent,
			};
			debug('Processed "create" options: %O', commandResult);
		});

	program
		.command('update')
		.description('Update an existing project from its template')
		.option('-t, --template <type>', 'Template type (cli, webpage, webapp, fullstack)')
		.option('-n, --name <name>', 'Project name')
		.option('-p, --package-manager <pm>', 'Package manager (npm, pnpm, yarn)', 'npm')
		.option('--create-github-repository', 'Create GitHub project')
		.option('-d, --directory <path>', 'Output directory', '.')
		.option('--overwrite', 'Overwrite existing directory by removing it first', false)
		.option('--skip-build', 'Skip build tooling (disables bundling and uses raw source files)', false)
		.option('--install-dependencies', 'Install dependencies after scaffolding', false)
		.option('--build', 'Run the CI script (lint, build, test) after updating', false)
		.option('--dev', 'Run the dev server after scaffolding', false)
		.option('--open', 'Open the browser after scaffolding', false)
		.option('--silent', 'Reduce console output', false)
		.action((opts) => {
			debug('Executing "update" command with options: %O', opts);
			if (opts.template === 'webapp' && opts.skipBuild) {
				p.log.error('The --skip-build option is not allowed for the "webapp" template.');
				process.exit(1);
			}
			commandResult = {
				...opts,
				update: true,
				template: opts.template as ProjectOptions['template'],
				projectName: opts.name,
				packageManager: opts.packageManager as ProjectOptions['packageManager'],
				directory: path.resolve(opts.directory),
				createGithubRepository: !!opts.createGithubRepository,
				overwrite: !!opts.overwrite,
				silent: !!opts.silent,
			};
			debug('Processed "update" options: %O', commandResult);
		});

	program
		.command('interactive')
		.description('Start interactive project configuration')
		.action(async () => {
			debug('Starting interactive configuration');

			const projectName = await p.text({
				message: 'Project name:',
				placeholder: 'my-app',
				defaultValue: 'my-app',
				validate: (value) => (value && value.length > 0 ? undefined : 'Project name is required'),
			});

			if (p.isCancel(projectName)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}

			const directory = await p.text({
				message: 'Target directory:',
				initialValue: '.',
			});

			if (p.isCancel(directory)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}

			const projectDir = path.resolve(directory as string, projectName as string);
			const exists = await pathExists(projectDir);
			const pkgPath = path.join(projectDir, 'package.json');
			const pkgExists = await pathExists(pkgPath);

			let existingConfig: any = {};
			if (pkgExists) {
				try {
					const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
					existingConfig = pkg['create-template-project'] || {};
					debug('Found existing project config: %O', existingConfig);
				} catch (e) {
					debug('Failed to read existing package.json: %O', e);
				}
			}

			let update = false;
			let overwrite = false;

			if (exists) {
				const action = await p.select({
					message: `Directory "${projectDir}" already exists. What would you like to do?`,
					options: [
						{label: 'Run an update', value: 'update'},
						{label: 'Overwrite existing directory by removing it first', value: 'overwrite'},
						{label: 'Cancel', value: 'cancel'},
					],
				});

				if (p.isCancel(action) || action === 'cancel') {
					p.cancel('Operation cancelled.');
					process.exit(0);
				}

				if (action === 'update') {
					update = true;
				} else if (action === 'overwrite') {
					overwrite = true;
				}
			}

			let template = existingConfig.template;
			if (!update || !template) {
				template = await p.select({
					message: 'Select project template:',
					initialValue: template || 'cli',
					options: [
						{label: 'CLI Application (Node.js)', value: 'cli'},
						{label: 'Webpage (Standalone)', value: 'webpage'},
						{label: 'Webapp (Express Backend)', value: 'webapp'},
						{label: 'Full-stack (Express + React/MUI Monorepo)', value: 'fullstack'},
					],
				});

				if (p.isCancel(template)) {
					p.cancel('Operation cancelled.');
					process.exit(0);
				}
			} else {
				p.log.info(`Using existing template type: ${template}`);
			}

			let packageManager = 'npm';
			if (!update) {
				packageManager = (await p.select({
					message: 'Select package manager:',
					initialValue: 'npm',
					options: [
						{label: 'npm', value: 'npm'},
						{label: 'pnpm', value: 'pnpm'},
						{label: 'yarn', value: 'yarn'},
					],
				})) as string;

				if (p.isCancel(packageManager)) {
					p.cancel('Operation cancelled.');
					process.exit(0);
				}
			}

			let skipBuild = false;
			if (template !== 'webapp') {
				const res = await p.confirm({
					message: 'Should we use build tooling? (Enables bundling using tsdown, and uses raw dist/ instead of src/)',
					initialValue: true,
				});

				if (p.isCancel(res)) {
					p.cancel('Operation cancelled.');
					process.exit(0);
				}
				skipBuild = !res;
			}

			const installDependenciesRes = await p.confirm({
				message: 'Should we install dependencies?',
				initialValue: true,
			});

			if (p.isCancel(installDependenciesRes)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}
			const installDependencies = installDependenciesRes as boolean;

			let build = false;
			if (installDependencies) {
				const res = await p.confirm({
					message: 'Should we run the CI script (lint, build, test)?',
					initialValue: true,
				});

				if (p.isCancel(res)) {
					p.cancel('Operation cancelled.');
					process.exit(0);
				}
				build = res as boolean;
			}

			const createGithubRepositoryRes = await p.confirm({
				message: 'Should we create a GitHub repository?',
				initialValue: false,
			});

			if (p.isCancel(createGithubRepositoryRes)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}
			const createGithubRepository = createGithubRepositoryRes as boolean;

			commandResult = {
				template: template as ProjectOptions['template'],
				projectName: projectName as string,
				packageManager: packageManager as ProjectOptions['packageManager'],
				createGithubRepository,
				directory: path.resolve(directory as string),
				update,
				overwrite,
				skipBuild,
				installDependencies,
				build,
				dev: false,
				open: false,
				silent: false,
			};
		});

	if (process.argv.length <= 2) {
		program.outputHelp();
		process.exit(0);
	}

	try {
		await program.parseAsync(process.argv);
	} catch (e: any) {
		if (e.code === 'commander.helpDisplayed' || e.code === 'commander.version' || e.code === 'PROCESS_EXIT_0') {
			process.exit(0);
		}
		if (e.code === 'PROCESS_EXIT_1') {
			process.exit(1);
		}
		p.cancel(e.message);
		process.exit(1);
	}

	if (!commandResult) {
		debug('No command result found');
		p.cancel('Unknown command or missing options.');
		process.exit(1);
	}

	// Validation using Zod
	debug('Validating command result with Zod');
	const validationResult = ProjectOptionsSchema.safeParse(commandResult);
	if (!validationResult.success) {
		const errors = validationResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
		p.cancel(`Invalid options: ${errors}`);
		process.exit(1);
	}

	commandResult = validationResult.data;

	const projectDir = path.resolve(commandResult.directory, commandResult.projectName);
	const exists = await pathExists(projectDir);

	if (exists && !commandResult.update && !commandResult.overwrite) {
		p.cancel(`Directory "${projectDir}" already exists. Use --overwrite to overwrite or "update" command.`);
		process.exit(1);
	}

	if (commandResult.open) {
		commandResult.dev = true;
		commandResult.installDependencies = true;
	}
	if (commandResult.dev || commandResult.build) {
		commandResult.installDependencies = true;
	}

	return commandResult;
};
