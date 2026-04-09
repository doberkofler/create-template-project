import path from 'node:path';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execa} from 'execa';
import debugLib from 'debug';
import {type ProjectOptions} from '#shared/types.js';
import {processContent as processContentInternal} from '#templating/index.js';

const debug = debugLib('create-template-project:utils:file');

type MergeablePackageJson = {
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	workspaces?: string[];
	bin?: string;
};

const toErrorDetail = (error: unknown): {message: string; detail: string; exitCode?: number} => {
	if (error instanceof Error) {
		const value = error as Error & {stdout?: string; stderr?: string; exitCode?: number};
		const stdout = value.stdout ?? '';
		const stderr = value.stderr ?? '';
		const detail = stdout.length > 0 || stderr.length > 0 ? `\n\nOutput:\n${stdout}\n${stderr}` : '';
		return {message: error.message, detail, exitCode: value.exitCode};
	}

	return {message: String(error), detail: ''};
};

export const getTemplateDir = (dirname: string, templateName: string): string => {
	const sourcePath = path.resolve(dirname, 'files');
	const distPath = path.resolve(dirname, 'templates', templateName, 'files');
	return existsSync(distPath) ? distPath : sourcePath;
};

export const getAllFiles = async (dirPath: string, arrayOfFiles: string[] = []): Promise<string[]> => {
	const entries = await fs.readdir(dirPath, {withFileTypes: true});
	const filteredEntries = entries.filter((entry) => entry.name !== '.DS_Store');
	const files = filteredEntries.filter((entry) => entry.isFile()).map((entry) => path.join(dirPath, entry.name));
	const directories = filteredEntries.filter((entry) => entry.isDirectory());
	const nestedResults = await Promise.all(
		directories.map(async (entry): Promise<string[]> => {
			const directoryPath = path.join(dirPath, entry.name);
			const nestedFiles = await getAllFiles(directoryPath);
			return nestedFiles;
		}),
	);

	return [...arrayOfFiles, ...files, ...nestedResults.flat()];
};

export const processContent = (filePath: string, content: string, opts: ProjectOptions, addedDeps: {name: string; description: string}[]): string =>
	processContentInternal(filePath, content, opts, addedDeps);

export const mergePackageJson = (target: MergeablePackageJson, source: MergeablePackageJson): void => {
	if (source.scripts !== undefined) {
		target.scripts = {...target.scripts, ...source.scripts};
	}
	if (source.dependencies !== undefined) {
		target.dependencies = {...target.dependencies, ...source.dependencies};
	}
	if (source.devDependencies !== undefined) {
		target.devDependencies = {
			...target.devDependencies,
			...source.devDependencies,
		};
	}
	if (source.workspaces !== undefined) {
		target.workspaces = source.workspaces;
	}
	if (source.bin !== undefined) {
		target.bin = source.bin;
	}
};

export const isSeedFile = (filePath: string): boolean => {
	const seedDirs = ['src/', 'client/src/', 'server/src/', 'backend/src/', 'frontend/src/'];
	const seedFiles = ['index.html', 'App.tsx', 'main.tsx', 'index.tsx', 'LICENSE'];
	return seedDirs.some((dir) => filePath.startsWith(dir)) || seedFiles.some((file) => filePath === file) || filePath.toLowerCase().endsWith('.md');
};

export const mergeFile = async (
	filePath: string,
	existing: string,
	template: string,
	log: {error: (msg: string) => void},
): Promise<'updated' | 'merged' | 'conflict' | 'error'> => {
	debug('Merging file: %s', filePath);
	const tempBase = `${filePath}.base.tmp`;
	const tempNew = `${filePath}.new.tmp`;

	try {
		await fs.writeFile(tempNew, template);
		await fs.writeFile(tempBase, existing);

		try {
			const stdio = debug.enabled ? 'inherit' : 'pipe';
			debug('Executing: git merge-file %s %s %s', filePath, tempBase, tempNew);
			await execa('git', ['merge-file', filePath, tempBase, tempNew], {
				stdio,
				preferLocal: true,
			});
			const postMergeContent = await fs.readFile(filePath, 'utf8');
			return postMergeContent.trim() !== template.trim() ? 'merged' : 'updated';
		} catch (error: unknown) {
			const detail = toErrorDetail(error);
			if (detail.exitCode !== undefined && detail.exitCode >= 1 && detail.exitCode < 128) {
				return 'conflict';
			}

			debug('Git merge-file failed: %O', error);
			log.error(`Failed to merge ${filePath}: ${detail.message}${detail.detail}`);
			return 'error';
		}
	} finally {
		await fs.rm(tempBase, {force: true});
		await fs.rm(tempNew, {force: true});
	}
};
