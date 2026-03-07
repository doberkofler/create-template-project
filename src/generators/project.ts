import fse from 'fs-extra';
import path from 'node:path';
import {ProjectOptions, TemplateDefinition} from '../types.js';
import {getBaseTemplate} from '../templates/base.js';
import {getNodeTemplate} from '../templates/node.js';
import {getVanillaHtmlTemplate} from '../templates/vanilla-html.js';
import {getVanillaJsTemplate} from '../templates/vanilla-js.js';
import {getReactTemplate} from '../templates/react.js';
import {execa} from 'execa';

export const generateProject = async (opts: ProjectOptions) => {
	const {template: type, projectName, directory} = opts;

	const templates: TemplateDefinition[] = [getBaseTemplate(projectName)];

	switch (type) {
		case 'node':
			templates.push(getNodeTemplate());
			break;
		case 'vanilla-html':
			templates.push(getVanillaHtmlTemplate());
			break;
		case 'vanilla-js':
			templates.push(getVanillaJsTemplate());
			break;
		case 'react':
			templates.push(getReactTemplate());
			break;
	}

	await fse.ensureDir(directory);

	// Merge templates
	const finalPkg = {
		name: projectName,
		version: '0.1.0',
		type: 'module',
		scripts: {} as Record<string, string>,
		dependencies: {} as Record<string, string>,
		devDependencies: {} as Record<string, string>,
	};

	for (const t of templates) {
		Object.assign(finalPkg.scripts, t.scripts);
		Object.assign(finalPkg.dependencies, t.dependencies);
		Object.assign(finalPkg.devDependencies, t.devDependencies);

		for (const file of t.files) {
			const filePath = path.join(directory, file.path);
			await fse.ensureDir(path.dirname(filePath));
			const content = typeof file.content === 'function' ? file.content() : file.content;
			await fse.writeFile(filePath, content);
		}
	}

	// Write package.json
	await fse.writeJson(path.join(directory, 'package.json'), finalPkg, {spaces: '\t'});

	// Write tsconfig.json
	const tsconfig = {
		compilerOptions: {
			target: 'ESNext',
			module: 'NodeNext',
			moduleResolution: 'NodeNext',
			strict: true,
			skipLibCheck: true,
			outDir: './dist',
			esModuleInterop: true,
		},
		include: ['src/**/*'],
	};
	await fse.writeJson(path.join(directory, 'tsconfig.json'), tsconfig, {spaces: '\t'});

	// Initialize Git
	try {
		await execa('git', ['init'], {cwd: directory});
		console.log('Initialized Git repository.');
	} catch (e) {
		console.error('Failed to initialize Git:', e);
	}

	// GitHub Integration
	if (opts.createGithub) {
		try {
			await execa('gh', ['repo', 'create', projectName, '--public', '--source=.', '--remote=origin'], {
				cwd: directory,
			});
			console.log('Created GitHub repository.');
		} catch (e) {
			console.error('Failed to create GitHub repository. Ensure "gh" CLI is installed and authenticated.', e);
		}
	}

	console.log(`\nProject "${projectName}" scaffolded successfully in ${directory}`);
	console.log('\nNext steps:');
	const relativePath = path.relative(process.cwd(), directory);
	if (relativePath && relativePath !== '.') {
		console.log(`  cd ${relativePath}`);
	}
	console.log('  npm install');
	console.log('  npm run dev');
};
