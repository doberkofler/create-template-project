import {describe, it, expect, vi, beforeEach} from 'vitest';
import {generateProject} from './project.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as p from '@clack/prompts';

type ProjectOptions = Parameters<typeof generateProject>[0];

const getOpts = (projectName: string, directory: string, update = false): ProjectOptions => ({
	template: 'cli',
	projectName,
	author: 'Test Author',
	githubUsername: 'test-user',
	packageManager: 'pnpm',
	createGithubRepository: false,
	directory,
	update,
	build: false,
	progress: true,
});

vi.mock(import('execa'));
vi.mock(import('@clack/prompts'), async (importOriginal) => {
	const {createPromptsMock} = await import('./test-mocks.js');
	const promptModuleMock = await createPromptsMock(importOriginal as () => Promise<Record<string, unknown>>);
	return promptModuleMock;
});

describe('generateProject Update Logic', () => {
	const tmpDir = path.join(os.tmpdir(), `create-template-project-update-test-${Math.random().toString(36).slice(2)}`);

	beforeEach(async () => {
		vi.clearAllMocks();
		await fs.mkdir(tmpDir, {recursive: true});
	});

	it('should run a clean update with no changes and report nothing', async () => {
		const projectName = 'clean-update-test';
		const projectPath = path.join(tmpDir, projectName);
		const opts = getOpts(projectName, projectPath);

		// 1. Initial Scaffold
		await generateProject(opts);

		const logInfo = vi.mocked(p.log.info);
		const logWarn = vi.mocked(p.log.warn);

		// Clear mocks to only catch update logs
		logInfo.mockClear();
		logWarn.mockClear();

		// 2. Run Update
		await generateProject({...opts, update: true});

		// 3. Verify: No files should be reported as updated or merged because they are identical
		const infoLogs = logInfo.mock.calls.map((call) => call[0]);
		expect(infoLogs.some((log) => log.includes('Updated:'))).not.toBe(true);
		expect(infoLogs.some((log) => log.includes('Merged:'))).not.toBe(true);
	});

	it('should report Merged when a managed file is modified locally', async () => {
		const projectName = 'merge-update-test';
		const projectPath = path.join(tmpDir, projectName);
		const opts = getOpts(projectName, projectPath);

		// 1. Initial Scaffold
		await generateProject(opts);

		// 2. Modify a managed file (e.g., tsconfig.json)
		const configPath = path.join(projectPath, 'tsconfig.json');
		await fs.writeFile(configPath, '{\n  "compilerOptions": {\n    "target": "ESNext"\n  }\n}');

		const logInfo = vi.mocked(p.log.info);
		logInfo.mockClear();

		// 3. Run Update
		await generateProject({...opts, update: true});

		// 4. Verify: tsconfig.json should be reported as merged
		const infoLogs = logInfo.mock.calls.map((call) => call[0]);
		expect(infoLogs.some((log) => log.includes('Merged: tsconfig.json'))).toBe(true);
	});

	it('should NOT touch seed files during update', async () => {
		const projectName = 'seed-update-test';
		const projectPath = path.join(tmpDir, projectName);
		const opts = getOpts(projectName, projectPath);

		// 1. Initial Scaffold
		await generateProject(opts);

		// 2. Modify a seed file (src/index.ts)
		const indexPath = path.join(projectPath, 'src/index.ts');
		const customCode = 'console.log("user code");';
		await fs.writeFile(indexPath, customCode);

		// 3. Run Update
		await generateProject({...opts, update: true});

		// 4. Verify: src/index.ts still has user code
		const finalContent = await fs.readFile(indexPath, 'utf8');
		expect(finalContent).toBe(customCode);
	});

	it('should throw error if update run on a project without configuration', async () => {
		const projectName = 'no-config-update-test';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				version: '1.0.0',
			}),
		);

		const opts = getOpts(projectName, projectPath, true);

		await expect(generateProject(opts)).rejects.toThrow(/No "create-template-project" configuration found/);
	});
});
