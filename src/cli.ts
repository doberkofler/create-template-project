import {Command} from 'commander';
import * as p from '@clack/prompts';
import {type ProjectOptions, ProjectOptionsSchema, TemplateTypeSchema} from '#shared/types.js';
import {execa} from 'execa';
import path from 'node:path';
import fs from 'node:fs/promises';
import debugLib from 'debug';
import {getAllTemplatesInfo, getTemplateInfo} from './generators/info.js';

type StoredProjectConfig = {
	template?: ProjectOptions['template'];
	githubUsername?: string;
	author?: string;
};

type StoredPackageJson = {
	name?: string;
	description?: string;
	keywords?: string[];
	author?: string;
	'create-template-project'?: StoredProjectConfig;
};

type InfoCommandOptions = {
	template?: string;
};

type CreateCommandOptions = {
	template: string;
	name: string;
	description?: string;
	keywords?: string;
	author?: string;
	githubUsername?: string;
	packageManager: ProjectOptions['packageManager'];
	createGithubRepository?: boolean;
	path: string;
	build?: boolean;
	progress?: boolean;
};

type UpdateCommandOptions = {
	template?: string;
	description?: string;
	keywords?: string;
	author?: string;
	githubUsername?: string;
	packageManager: ProjectOptions['packageManager'];
	createGithubRepository?: boolean;
	directory: string;
	build?: boolean;
	progress?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isPackageManager = (value: string): value is ProjectOptions['packageManager'] => value === 'npm' || value === 'pnpm' || value === 'yarn';

const pathExists = async (filePath: string): Promise<boolean> => {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
};

const parseStoredPackageJson = (raw: string): StoredPackageJson => {
	const parsed = JSON.parse(raw) as unknown;
	if (!isRecord(parsed)) {
		return {};
	}

	const pkg = parsed;
	const config = pkg['create-template-project'];
	const configRecord = isRecord(config) ? config : undefined;

	let template: ProjectOptions['template'] | undefined;
	if (configRecord !== undefined && typeof configRecord.template === 'string') {
		const result = TemplateTypeSchema.safeParse(configRecord.template);
		if (result.success) {
			template = result.data;
		}
	}

	return {
		name: typeof pkg.name === 'string' ? pkg.name : undefined,
		description: typeof pkg.description === 'string' ? pkg.description : undefined,
		keywords: Array.isArray(pkg.keywords) ? pkg.keywords.filter((keyword): keyword is string => typeof keyword === 'string') : undefined,
		author: typeof pkg.author === 'string' ? pkg.author : undefined,
		'create-template-project': configRecord
			? {
					template,
					githubUsername: typeof configRecord.githubUsername === 'string' ? configRecord.githubUsername : undefined,
					author: typeof configRecord.author === 'string' ? configRecord.author : undefined,
				}
			: undefined,
	};
};

const noop = (): undefined => undefined;

const stripQuotes = (str: string | undefined): string | undefined => {
	if (typeof str !== 'string') {
		return str;
	}
	let result = str.trim();
	while (result.length >= 2) {
		const [first] = result;
		const last = result.at(-1);
		if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
			result = result.slice(1, -1).trim();
		} else {
			break;
		}
	}
	return result;
};

const getDefaultAuthor = async (): Promise<string> => {
	try {
		const {stdout} = await execa('git', ['config', 'user.name']);
		return stdout.trim();
	} catch {
		return '';
	}
};

const getDefaultGithubUsername = async (): Promise<string> => {
	try {
		const {stdout} = await execa('git', ['config', 'github.user']);
		return stdout.trim();
	} catch {
		return '';
	}
};

const debug = debugLib('create-template-project:cli');

export const parseArgs = async (): Promise<ProjectOptions> => {
	debug('Parsing CLI arguments: %O', process.argv);
	const program = new Command();
	if (process.env.NODE_ENV === 'test') {
		program.configureOutput({
			writeOut: noop,
			writeErr: noop,
		});
	}

	program
		.name('create-template-project')
		.exitOverride()
		.description('Scaffold a new project template')
		.version('0.1.0')
		.option('--debug', 'Enable debug output')
		.on('option:debug', () => {
			process.env.DEBUG = 'create-template-project:*';
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

	let commandResult: Partial<ProjectOptions> | undefined;

	program
		.command('info')
		.description('Show detailed information about available templates and their components')
		.option('-t, --template <type>', 'Template type (cli, web-vanilla, web-app, web-fullstack)')
		.action((opts: InfoCommandOptions) => {
			debug('Executing "info" command with options: %O', opts);
			p.intro('Template Information');

			if (opts.template !== undefined && opts.template.length > 0) {
				const template = stripQuotes(opts.template);
				const typeResult = TemplateTypeSchema.safeParse(template);
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
		.option('--description <description>', 'Project description')
		.option('-k, --keywords <keywords>', 'Project keywords (comma separated)')
		.option('-a, --author <author>', "Author name (defaults to 'git config user.name')")
		.option('--github-username <username>', "GitHub username (defaults to 'git config github.user')")
		.option('-p, --package-manager <pm>', 'Package manager (npm, pnpm, yarn)', 'pnpm')
		.option('--create-github-repository', 'Create GitHub repository and push initial commit')
		.requiredOption('--path <path>', 'Output directory')
		.option('--build', 'Run the CI script (lint, build, test) after scaffolding', false)
		.option('--no-progress', 'Do not show progress indicators')
		.action(async (opts: CreateCommandOptions) => {
			debug('Executing "create" command with options: %O', opts);
			const templateInput = stripQuotes(opts.template);
			const templateResult = TemplateTypeSchema.safeParse(templateInput);
			if (!templateResult.success) {
				p.log.error(`Invalid template type: ${opts.template}. Must be one of: cli, web-vanilla, web-app, web-fullstack`);
				process.exit(1);
			}
			commandResult = {
				update: false,
				template: templateResult.data,
				projectName: opts.name,
				description: opts.description,
				keywords: opts.keywords,
				author: opts.author ?? (await getDefaultAuthor()),
				githubUsername: opts.githubUsername ?? (await getDefaultGithubUsername()),
				packageManager: opts.packageManager,
				directory: path.resolve(opts.path),
				createGithubRepository: Boolean(opts.createGithubRepository),
				build: Boolean(opts.build),
				progress: Boolean(opts.progress),
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
  - Seed Files: Files in 'src/', 'client/src/', etc., and ALL markdown files (*.md) are considered "seed" files and are NEVER overwritten or modified during an update to protect your application logic and documentation.
  - package.json: Dependencies and scripts are merged. Existing versions are preserved unless they are missing.
  - Merging: For non-seed files, the tool attempts to merge template changes. If a conflict occurs, it will be marked with standard git conflict markers.
  - Confirmation: The command will always show a summary of proposed changes (ADD, MODIFY) and ask for your confirmation before applying them.
`,
		)
		.option('-t, --template <type>', 'Template type (cli, web-vanilla, web-app, web-fullstack)')
		.option('--description <description>', 'Project description')
		.option('-k, --keywords <keywords>', 'Project keywords (comma separated)')
		.option('-a, --author <author>', "Author name (defaults to 'git config user.name')")
		.option('--github-username <username>', "GitHub username (defaults to 'git config github.user')")
		.option('-p, --package-manager <pm>', 'Package manager (npm, pnpm, yarn)', 'pnpm')
		.option('--create-github-repository', 'Create GitHub repository and push initial commit')
		.option('-d, --directory <path>', 'Output directory', '.')
		.option('--build', 'Run the CI script (lint, build, test) after updating', false)
		.option('--dev', 'Run the dev server after scaffolding', false)
		.option('--open', 'Open the browser after scaffolding', false)
		.option('--no-progress', 'Do not show progress indicators')
		.action(async (opts: UpdateCommandOptions) => {
			debug('Executing "update" command with options: %O', opts);

			const directory = path.resolve(opts.directory);
			const pkgPath = path.join(directory, 'package.json');

			if (!(await pathExists(pkgPath))) {
				p.log.error(`No package.json found in ${directory}. The update command must be run in a project directory.`);
				process.exit(1);
			}

			let pkg: StoredPackageJson;
			try {
				pkg = parseStoredPackageJson(await fs.readFile(pkgPath, 'utf8'));
			} catch (error: unknown) {
				const message = error instanceof Error ? error.message : String(error);
				p.log.error(`Failed to read or parse package.json at ${pkgPath}: ${message}`);
				process.exit(1);
			}

			if (pkg.name === undefined || pkg.name.length === 0) {
				p.log.error(`No name property found in ${pkgPath}.`);
				process.exit(1);
			}

			const projectConfig = pkg['create-template-project'];
			// eslint-disable-next-line @typescript-eslint/prefer-optional-chain
			if (projectConfig === undefined || projectConfig.template === undefined) {
				p.log.error(`No "create-template-project" configuration found in ${pkgPath}. The update command can only be used on projects created with this tool.`);
				process.exit(1);
			}

			const storedTemplate = projectConfig.template;
			let template = storedTemplate;
			if (opts.template !== undefined) {
				const templateInput = stripQuotes(opts.template);
				const templateResult = TemplateTypeSchema.safeParse(templateInput);
				if (!templateResult.success) {
					p.log.error(`Invalid template type: ${opts.template}. Must be one of: cli, web-vanilla, web-app, web-fullstack`);
					process.exit(1);
				}
				template = templateResult.data;
			}
			commandResult = {
				...opts,
				update: true,
				template,
				projectName: pkg.name,
				description: opts.description ?? pkg.description,
				keywords: opts.keywords ?? (pkg.keywords !== undefined ? pkg.keywords.join(', ') : undefined),
				author: opts.author ?? pkg.author ?? (await getDefaultAuthor()),
				githubUsername: opts.githubUsername ?? projectConfig.githubUsername ?? (await getDefaultGithubUsername()),
				packageManager: opts.packageManager,
				directory: directory,
				createGithubRepository: Boolean(opts.createGithubRepository),
				build: Boolean(opts.build),
				progress: Boolean(opts.progress),
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
				validate: (value = '') => (value.length > 0 ? undefined : 'Project name is required'),
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

			const projectDir = path.resolve(directory, projectName);
			const exists = await pathExists(projectDir);
			const pkgPath = path.join(projectDir, 'package.json');
			const pkgExists = await pathExists(pkgPath);

			let existingConfig: StoredProjectConfig = {};
			let existingAuthor = '';
			let existingGithubUsername = '';
			let existingDescription = '';
			let existingKeywords: string[] = [];
			if (pkgExists) {
				try {
					const pkg = parseStoredPackageJson(await fs.readFile(pkgPath, 'utf8'));
					existingConfig = pkg['create-template-project'] ?? {};
					existingAuthor = pkg.author ?? '';
					existingGithubUsername = existingConfig.githubUsername ?? '';
					existingDescription = pkg.description ?? '';
					existingKeywords = pkg.keywords ?? [];
					debug('Found existing project config: %O', existingConfig);
				} catch (error) {
					debug('Failed to read existing package.json: %O', error);
				}
			}

			const projectDescription = await p.text({
				message: 'Project description:',
				placeholder: 'A new project',
				defaultValue: existingDescription,
			});

			if (p.isCancel(projectDescription)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}

			const projectKeywords = await p.text({
				message: 'Project keywords (comma separated):',
				placeholder: 'cli, nodejs, typescript',
				defaultValue: existingKeywords.join(', '),
			});

			if (p.isCancel(projectKeywords)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}

			const defaultAuthor = await getDefaultAuthor();
			const authorDefault = existingAuthor.length > 0 ? existingAuthor : (existingConfig.author ?? defaultAuthor);
			const author = await p.text({
				message: 'Author name:',
				placeholder: 'Your Name',
				defaultValue: authorDefault,
				validate: (value = '') => (value.length > 0 ? undefined : 'Author name is required'),
			});

			if (p.isCancel(author)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}

			const defaultGithubUsername = await getDefaultGithubUsername();
			const githubDefault = existingGithubUsername.length > 0 ? existingGithubUsername : defaultGithubUsername;
			const githubUsername = await p.text({
				message: 'GitHub username:',
				placeholder: 'your-github-username',
				defaultValue: githubDefault,
				validate: (value = '') => (value.length > 0 ? undefined : 'GitHub username is required'),
			});

			if (p.isCancel(githubUsername)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}

			let update = false;
			if (exists) {
				const action = await p.select({
					message: `Directory "${projectDir}" already exists. What would you like to do?`,
					options: [
						{label: 'Run an update', value: 'update'},
						{label: 'Cancel', value: 'cancel'},
					],
				});

				if (p.isCancel(action) || action === 'cancel') {
					p.cancel('Operation cancelled.');
					process.exit(0);
				}

				if (!existingConfig.template) {
					p.log.error(
						`No "create-template-project" configuration found in ${pkgPath}. The update command can only be used on projects created with this tool.`,
					);
					process.exit(1);
				}
				update = true;
			}

			const {template: existingTemplate} = existingConfig;
			let template: ProjectOptions['template'] | undefined = existingTemplate;
			if (!update || !template) {
				const selectedTemplate = await p.select({
					message: 'Select project template:',
					initialValue: template ?? 'cli',
					options: [
						{label: 'CLI Application (Node.js)', value: 'cli'},
						{label: 'Web-Vanilla (Standalone)', value: 'web-vanilla'},
						{label: 'Web-App (React + MUI)', value: 'web-app'},
						{
							label: 'Web-Fullstack (Express + React Monorepo)',
							value: 'web-fullstack',
						},
					],
				});

				if (p.isCancel(selectedTemplate)) {
					p.cancel('Operation cancelled.');
					process.exit(0);
				}

				if (typeof selectedTemplate !== 'string') {
					p.cancel('Invalid template selection.');
					process.exit(1);
				}

				const templateResult = TemplateTypeSchema.safeParse(selectedTemplate);
				if (!templateResult.success) {
					p.cancel('Invalid template selection.');
					process.exit(1);
				}
				template = templateResult.data;
			} else {
				p.log.info(`Using existing template type: ${template}`);
			}

			let packageManager: ProjectOptions['packageManager'] = 'pnpm';
			if (!update) {
				const selectedPackageManager = await p.select({
					message: 'Select package manager:',
					initialValue: 'pnpm',
					options: [
						{label: 'npm', value: 'npm'},
						{label: 'pnpm', value: 'pnpm'},
						{label: 'yarn', value: 'yarn'},
					],
				});

				if (p.isCancel(selectedPackageManager)) {
					p.cancel('Operation cancelled.');
					process.exit(0);
				}

				if (typeof selectedPackageManager !== 'string' || !isPackageManager(selectedPackageManager)) {
					p.cancel('Invalid package manager selection.');
					process.exit(1);
				}

				packageManager = selectedPackageManager;
			}

			const build = await p.confirm({
				message: 'Should we run the CI script (lint, build, test)?',
				initialValue: true,
			});

			if (p.isCancel(build)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}

			const createGithubRepositoryRes = await p.confirm({
				message: 'Create GitHub repository and push initial commit?',
				initialValue: false,
			});

			if (p.isCancel(createGithubRepositoryRes)) {
				p.cancel('Operation cancelled.');
				process.exit(0);
			}
			const createGithubRepository = createGithubRepositoryRes;

			commandResult = {
				template,
				projectName,
				description: projectDescription,
				keywords: projectKeywords,
				author,
				githubUsername,
				packageManager,
				createGithubRepository,
				directory: projectDir,
				update,
				build,
				progress: true,
			};
		});

	if (process.argv.length <= 2) {
		program.outputHelp();
		process.exit(0);
	}

	try {
		await program.parseAsync(process.argv);
	} catch (error: unknown) {
		const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as {code: unknown}).code) : '';
		if (code === 'commander.helpDisplayed' || code === 'commander.version' || code === 'PROCESS_EXIT_0') {
			process.exit(0);
		}
		if (code === 'PROCESS_EXIT_1') {
			process.exit(1);
		}
		const message = error instanceof Error ? error.message : String(error);
		p.cancel(message);
		process.exit(1);
	}

	if (!commandResult) {
		debug('No command result found');
		p.cancel('Unknown command or missing options.');
		process.exit(1);
	}

	// Sanitize string inputs (strip surrounding quotes)
	const template = stripQuotes(commandResult.template);
	if (template !== undefined) {
		const templateResult = TemplateTypeSchema.safeParse(template);
		if (templateResult.success) {
			commandResult.template = templateResult.data;
		}
	}
	if (commandResult.projectName !== undefined) {
		const projectName = stripQuotes(commandResult.projectName);
		if (projectName !== undefined) {
			commandResult.projectName = projectName;
		}
	}
	if (commandResult.description !== undefined) {
		commandResult.description = stripQuotes(commandResult.description);
	}
	if (commandResult.keywords !== undefined) {
		commandResult.keywords = stripQuotes(commandResult.keywords);
	}
	if (commandResult.author !== undefined) {
		const author = stripQuotes(commandResult.author);
		if (author !== undefined) {
			commandResult.author = author;
		}
	}
	if (commandResult.githubUsername !== undefined) {
		const githubUsername = stripQuotes(commandResult.githubUsername);
		if (githubUsername !== undefined) {
			commandResult.githubUsername = githubUsername;
		}
	}
	if (commandResult.packageManager !== undefined) {
		const packageManager = stripQuotes(commandResult.packageManager);
		if (packageManager !== undefined && isPackageManager(packageManager)) {
			commandResult.packageManager = packageManager;
		}
	}

	// Validation using Zod
	debug('Validating command result with Zod');
	const validationResult = ProjectOptionsSchema.safeParse(commandResult);
	if (!validationResult.success) {
		const errors = validationResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
		p.cancel(`Invalid options: ${errors}`);
		process.exit(1);
	}

	const validated = validationResult.data;

	const projectDir = validated.directory;
	const exists = await pathExists(projectDir);

	if (exists && !validated.update) {
		p.cancel(`Directory "${projectDir}" already exists. Use the "update" command to update.`);
		process.exit(1);
	}

	return validated;
};
