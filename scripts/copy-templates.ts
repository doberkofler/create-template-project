import fs from 'node:fs/promises';
import path from 'node:path';

const pathExists = async (p: string): Promise<boolean> => {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
};

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'src/templates');
const dist = path.join(root, 'dist/templates');

const copyTemplates = async (): Promise<void> => {
	// Copy config
	const srcConfig = path.join(root, 'src/config');
	const distConfig = path.join(root, 'dist/config');
	if (await pathExists(srcConfig)) {
		await fs.mkdir(distConfig, {recursive: true});
		await fs.cp(srcConfig, distConfig, {recursive: true});
		console.log(`Copied config files to dist`);
	}

	const templates = ['base', 'cli', 'web-vanilla', 'web-app', 'web-fullstack'];
	const copyOperations = templates.map(async (templateName): Promise<void> => {
		const srcFiles = path.join(src, templateName, 'files');
		const distFiles = path.join(dist, templateName, 'files');

		if (await pathExists(srcFiles)) {
			await fs.mkdir(distFiles, {recursive: true});
			await fs.cp(srcFiles, distFiles, {recursive: true});
			console.log(`Copied ${templateName} template files to dist`);
		}
	});

	await Promise.all(copyOperations);
};

await copyTemplates();
