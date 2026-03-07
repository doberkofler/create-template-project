import {Command} from 'commander';
import {select, input, confirm} from '@inquirer/prompts';
import {ProjectOptions, TemplateTypeSchema} from './types.js';
import path from 'node:path';

export const parseArgs = async (): Promise<ProjectOptions> => {
	const program = new Command();

	program
		.name('create-template-project')
		.description('Scaffold a new project template')
		.option('-t, --template <type>', 'Template type (node, vanilla-html, vanilla-js, react)')
		.option('-n, --name <name>', 'Project name')
		.option('--github', 'Create GitHub project')
		.option('-d, --directory <path>', 'Output directory', '.');

	program.parse(process.argv);

	const opts = program.opts();

	const template =
		opts.template && TemplateTypeSchema.safeParse(opts.template).success
			? opts.template
			: await select({
					message: 'Select project template:',
					choices: [
						{name: 'Node.js', value: 'node'},
						{name: 'Vanilla HTML', value: 'vanilla-html'},
						{name: 'Vanilla JavaScript', value: 'vanilla-js'},
						{name: 'React', value: 'react'},
					],
				});

	const projectName =
		opts.name ||
		(await input({
			message: 'Project name:',
			default: 'my-awesome-project',
			validate: (value) => (value.length > 0 ? true : 'Project name is required'),
		}));

	const createGithub =
		opts.github !== undefined
			? opts.github
			: await confirm({
					message: 'Should we create a GitHub project?',
					default: false,
				});

	const directory =
		program.getOptionValueSource('directory') === 'cli'
			? opts.directory
			: await input({
					message: 'Target directory:',
					default: opts.directory,
				});

	return {
		template,
		projectName,
		createGithub,
		directory: path.resolve(directory),
	};
};
