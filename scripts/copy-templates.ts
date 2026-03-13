import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const pathExists = (p: string) =>
	fs
		.access(p)
		.then(() => true)
		.catch(() => false);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src/templates');
const dist = path.join(root, 'dist/templates');

async function copyTemplates() {
	// Copy config
	const srcConfig = path.join(root, 'src/config');
	const distConfig = path.join(root, 'dist/config');
	if (await pathExists(srcConfig)) {
		await fs.mkdir(distConfig, {recursive: true});
		await fs.cp(srcConfig, distConfig, {recursive: true});
		console.log(`Copied config files to dist`);
	}

	const templates = ['base', 'cli', 'webpage', 'webapp', 'fullstack'];

	for (const t of templates) {
		const srcFiles = path.join(src, t, 'files');
		const distFiles = path.join(dist, t, 'files');

		if (await pathExists(srcFiles)) {
			await fs.mkdir(distFiles, {recursive: true});
			await fs.cp(srcFiles, distFiles, {recursive: true});
			console.log(`Copied ${t} template files to dist`);
		}
	}
}

copyTemplates().catch(console.error);
