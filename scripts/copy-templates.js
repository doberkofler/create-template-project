import fse from 'fs-extra';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src/templates');
const dist = path.join(root, 'dist/templates');

async function copyTemplates() {
	const templates = ['base', 'cli', 'webpage', 'webapp', 'fullstack'];

	for (const t of templates) {
		const srcFiles = path.join(src, t, 'files');
		const distFiles = path.join(dist, t, 'files');

		if (await fse.pathExists(srcFiles)) {
			await fse.ensureDir(distFiles);
			await fse.copy(srcFiles, distFiles);
			console.log(`Copied ${t} template files to dist`);
		}
	}
}

copyTemplates().catch(console.error);
