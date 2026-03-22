import {Command} from 'commander';
import * as p from '@clack/prompts';
import {ProjectOptions, ProjectOptionsSchema, TemplateTypeSchema} from './types.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import debugLib from 'debug';
import {getAllTemplatesInfo, getTemplateInfo} from './generators/info.js';

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
			process.env['DEBUG'] = 'create-template-project:*';
			debugLib.enable('create-template-project:*');
		})
		.addHelpText(
			'after',
			`
Commands:
  create      - Create a new project from a template.
  update      - Update an existing project from its template.
  interactive - Start interactive project configuration.
  info        - Show detailed information about available templates and components.

Templates:
  cli            - Node.js CLI application with commander and cli-progress.
  web-vanilla    - Standalone web page (modern HTML/JS).
  web-app        - React application with MUI and TanStack Query.
  web-fullstack  - Full-stack monorepo with Express server and React/MUI client.
`,
		);

	let commandResult: ProjectOptions | undefined;

	program
		.command('info')
		.description('Show detailed information about available templates and their components')
		.option('-t, --template <type>', 'Template type (cli, web-vanilla, web-app, web-fullstack)')
		.action((opts) => {
			debug('Executing "info" command with options: %O', opts);
			p.intro('Template Information');

			if (opts.template) {
				const typeResult = TemplateTypeSchema.safeParse(opts.template);
				if (!typeResult.success) {
					p.log.error(`Invalid template type: ${opts.template}. Must be one of: cli, web-vanilla, web-app, web-fullstack`);
					process.exit(1);
				}
				const info = getTemplateInfo(typeResult.data);
				p.note(
					[`Description: ${info.description}`, '', 'Components:', ...info.components.map((c) => `  ● ${c.name}: ${c.description}`)].join('\n'),
					`Template: ${info.name}`,
				);
			} else {
				const allInfo = getAllTemplatesInfo();
				for (const info of allInfo) {
					p.note(
						[`Description: ${info.description}`, '', 'Components:', ...info.components.map((c) => `  ● ${c.name}: ${c.description}`)].join('\n'),
						`Template: ${info.name}`,
					);
				}
			}

			p.outro('Use "create" to scaffold a new project.');
			process.exit(0);
		});

	program
		.command('create')
		.description('Create a new project from a template')
		.option('-t, --template <type>', 'Template type (cli, web-vanilla, web-app, web-fullstack)')
		.option('-n, --name <name>', 'Project name')
		.option('-p, --package-manager <pm>', 'Package manager (npm, pnpm, yarn)', 'pnpm')
		.option('--create-github-repository', 'Create GitHub project')
		.option('-d, --directory <path>', 'Output directory', '.')
		.option('--overwrite', 'Overwrite existing directory by removing it first', false)
		.option('--install-dependencies', 'Install dependencies after scaffolding', false)
		.option('--build', 'Run the CI script (lint, build, test) after scaffolding', false)
		.option('--dev', 'Run the dev server after scaffolding', false)
		.option('--open', 'Open the browser after scaffolding', false)
		.option('--no-progress', 'Do not show progress indicators')
		.action((opts) => {
			debug('Executing "create" command with options: %O', opts);
			commandResult = {
				...opts,
				update: false,
				template: opts.template as ProjectOptions['template'],
				projectName: opts.name,
				packageManager: opts.packageManager as ProjectOptions['packageManager'],
				directory: path.resolve(opts.directory),
				createGithubRepository: !!opts.createGithubRepository,
				overwrite: !!opts.overwrite,
				progress: !!opts.progress,
			};
			debug('Processed "create" options: %O', commandResult);
		});

	program
		.command('update')
		.description('Update an existing project from its template')
		.addHelpText(
			'after',
			`
Details:
  The update command syncs your project with the latest template changes.
  It intelligently merges changes into your existing files using 'git merge-file'.

Restrictions & Behavior:
  - Seed Files: Files in 'src/', 'client/src/', etc., are considered "seed" files and are NEVER overwritten or modified during an update to protect your application logic.
  - package.json: Dependencies and scripts are merged. Existing versions are preserved unless they are missing.
  - Merging: For non-seed files, the tool attempts to merge template changes. If a conflict occurs, it will be marked with standard git conflict markers.
  - Confirmation: The command will always show a summary of proposed changes (ADD, MODIFY) and ask for your confirmation before applying them.
`,
		)
		.option('-t, --template <type>', 'Template type (cli, web-vanilla, web-app, web-fullstack)')
		.option('-p, --package-manager <pm>', 'Package manager (npm, pnpm, yarn)', 'pnpm')
		.option('--create-github-repository', 'Create GitHub project')
		.option('-d, --directory <path>', 'Output directory', '.')
		.option('--overwrite', 'Overwrite existing directory by removing it first', false)
		.option('--install-dependencies', 'Install dependencies after scaffolding', false)
		.option('--build', 'Run the CI script (lint, build, test) after updating', false)
		.option('--dev', 'Run the dev server after scaffolding', false)
		.option('--open', 'Open the browser after scaffolding', false)
		.option('--no-progress', 'Do not show progress indicators')
		.action(async (opts) => {
			debug('Executing "update" command with options: %O', opts);

			const directory = path.resolve(opts.directory);
			const pkgPath = path.join(directory, 'package.json');

			if (!(await pathExists(pkgPath))) {
				p.log.error(`No package.json found in ${directory}. The update command must be run in a project directory.`);
				process.exit(1);
			}

			let pkg: any;
			try {
				pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
			} catch (e: any) {
				p.log.error(`Failed to read or parse package.json at ${pkgPath}: ${e.message}`);
				process.exit(1);
			}

			if (!pkg.name) {
				p.log.error(`No name property found in ${pkgPath}.`);
				process.exit(1);
			}

			commandResult = {
				...opts,
				update: true,
				template: opts.template as ProjectOptions['template'],
				projectName: pkg.name,
				packageManager: opts.packageManager as ProjectOptions['packageManager'],
				directory: directory,
				createGithubRepository: !!opts.createGithubRepository,
				overwrite: !!opts.overwrite,
				progress: !!opts.progress,
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
						{label: 'Web-Vanilla (Standalone)', value: 'web-vanilla'},
						{label: 'Web-App (React + MUI)', value: 'web-app'},
						{label: 'Web-Fullstack (Express + React Monorepo)', value: 'web-fullstack'},
					],
				});

				if (p.isCancel(template)) {
					p.cancel('Operation cancelled.');
					process.exit(0);
				}
			} else {
				p.log.info(`Using existing template type: ${template}`);
			}

			let packageManager = 'pnpm';
			if (!update) {
				packageManager = (await p.select({
					message: 'Select package manager:',
					initialValue: 'pnpm',
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
				installDependencies,
				build,
				dev: false,
				open: false,
				progress: true,
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
