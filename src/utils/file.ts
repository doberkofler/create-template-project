import path from 'node:path';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execa} from 'execa';
import debugLib from 'debug';
import {ProjectOptions} from '../types.js';
import {processContent as processContentInternal} from './templating/index.js';

const debug = debugLib('create-template-project:utils:file');

export function getTemplateDir(dirname: string, templateName: string): string {
	const sourcePath = path.resolve(dirname, 'files');
	const distPath = path.resolve(dirname, 'templates', templateName, 'files');
	return existsSync(distPath) ? distPath : sourcePath;
}

export async function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
	const files = await fs.readdir(dirPath);

	for (const file of files) {
		if (file === '.DS_Store') {
			continue;
		}
		if ((await fs.stat(path.join(dirPath, file))).isDirectory()) {
			arrayOfFiles = await getAllFiles(path.join(dirPath, file), arrayOfFiles);
		} else {
			arrayOfFiles.push(path.join(dirPath, file));
		}
	}

	return arrayOfFiles;
}

export function processContent(filePath: string, content: string, opts: ProjectOptions, addedDeps: Array<{name: string; description: string}>): string {
	return processContentInternal(filePath, content, opts, addedDeps);
}

export function mergePackageJson(target: any, source: any) {
	if (source.scripts) {
		target.scripts = {...target.scripts, ...source.scripts};
	}
	if (source.dependencies) {
		target.dependencies = {...target.dependencies, ...source.dependencies};
	}
	if (source.devDependencies) {
		target.devDependencies = {
			...target.devDependencies,
			...source.devDependencies,
		};
	}
	if (source.workspaces) {
		target.workspaces = source.workspaces;
	}
	if (source.bin) {
		target.bin = source.bin;
	}
}

export function isSeedFile(filePath: string): boolean {
	const seedDirs = ['src/', 'client/src/', 'server/src/', 'backend/src/', 'frontend/src/'];
	const seedFiles = ['index.html', 'App.tsx', 'main.tsx', 'index.tsx', 'LICENSE'];
	return seedDirs.some((dir) => filePath.startsWith(dir)) || seedFiles.some((file) => filePath === file) || filePath.toLowerCase().endsWith('.md');
}

export async function mergeFile(
	filePath: string,
	existing: string,
	template: string,
	log: {error: (msg: string) => void},
): Promise<'updated' | 'merged' | 'conflict' | 'error'> {
	debug('Merging file: %s', filePath);
	const tempBase = filePath + '.base.tmp';
	const tempNew = filePath + '.new.tmp';

	try {
		await fs.writeFile(tempNew, template);
		await fs.writeFile(tempBase, '');

		try {
			const stdio = debug.enabled ? 'inherit' : 'pipe';
			debug('Executing: git merge-file %s %s %s', filePath, tempBase, tempNew);
			await execa('git', ['merge-file', filePath, tempBase, tempNew], {
				stdio,
				preferLocal: true,
			});
			const postMergeContent = await fs.readFile(filePath, 'utf8');
			return postMergeContent.trim() !== template.trim() ? 'merged' : 'updated';
		} catch (e: any) {
			if (e.exitCode >= 1 && e.exitCode < 128) {
				return 'conflict';
			} else {
				debug('Git merge-file failed: %O', e);
				const detail = e.stdout || e.stderr ? `\n\nOutput:\n${e.stdout}\n${e.stderr}` : '';
				log.error(`Failed to merge ${filePath}: ${e.message}${detail}`);
				return 'error';
			}
		}
	} finally {
		await fs.rm(tempBase, {force: true});
		await fs.rm(tempNew, {force: true});
	}
}
