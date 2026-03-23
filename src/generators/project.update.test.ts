import {describe, it, expect, vi, beforeEach} from 'vitest';
import {generateProject} from './project.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as p from '@clack/prompts';

vi.mock('execa', () => ({
	execa: vi.fn(async () => ({stdout: '', stderr: ''})),
}));

vi.mock('@clack/prompts', async (importOriginal) => {
	const actual: any = await importOriginal();
	return {
		...actual,
		intro: vi.fn(),
		outro: vi.fn(),
		select: vi.fn(),
		text: vi.fn(),
		confirm: vi.fn(),
		isCancel: vi.fn(() => false),
		cancel: vi.fn(),
		note: vi.fn(),
		spinner: vi.fn(() => ({
			start: vi.fn(),
			stop: vi.fn(),
			message: vi.fn(),
		})),
		log: {
			success: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
		},
	};
});

describe('generateProject Update Logic', () => {
	const tmpDir = path.join(os.tmpdir(), 'create-template-project-update-test-' + Math.random().toString(36).slice(2));

	beforeEach(async () => {
		vi.clearAllMocks();
		await fs.mkdir(tmpDir, {recursive: true});
	});

	it('should run a clean update with no changes and report nothing', async () => {
		const projectName = 'clean-update-test';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: false,
		};

		// 1. Initial Scaffold
		await generateProject(opts);

		const logInfo = vi.mocked(p.log.info);
		const logWarn = vi.mocked(p.log.warn);

		// Clear mocks to only catch update logs
		logInfo.mockClear();
		logWarn.mockClear();

		// 2. Run Update
		await generateProject({...opts, update: true} as any);

		// 3. Verify: No files should be reported as updated or merged because they are identical
		const infoLogs = logInfo.mock.calls.map((call) => call[0]);
		expect(infoLogs.some((log) => log.includes('Updated:'))).toBe(false);
		expect(infoLogs.some((log) => log.includes('Merged:'))).toBe(false);
	});

	it('should report Merged when a managed file is modified locally', async () => {
		const projectName = 'merge-update-test';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: false,
		};

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
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: false,
		};

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

		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: true,
		};

		await expect(generateProject(opts)).rejects.toThrow(/No "create-template-project" configuration found/);
	});
});
