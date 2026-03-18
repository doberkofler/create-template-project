import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {generateProject} from './project.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const pathExists = (p: string) =>
	fs
		.access(p)
		.then(() => true)
		.catch(() => false);

// This test suite performs real scaffolding and runs real commands.
// It is intended to catch issues that mocked unit tests miss.
describe('generateProject (Integration - CLI)', () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = path.join(os.tmpdir(), 'cp-integration-cli-' + Math.random().toString(36).slice(2));
		await fs.mkdir(tmpDir, {recursive: true});
	});

	afterEach(async () => {
		await fs.rm(tmpDir, {recursive: true, force: true});
	});

	it('should scaffold and pass CI for cli template', async () => {
		const projectName = 'cli-e2e';
		const opts: any = {
			template: 'cli' as const,
			projectName,
			packageManager: 'pnpm',
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
			installDependencies: true,
			build: true,
			silent: true,
		};

		await generateProject(opts);

		const projectPath = path.join(tmpDir, projectName);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'dist/index.mjs'))).toBe(true);
	}, 300000);
});
