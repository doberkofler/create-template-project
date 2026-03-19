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
describe('generateProject (Integration - Web-Vanilla)', () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = path.join(os.tmpdir(), 'cp-integration-web-vanilla-' + Math.random().toString(36).slice(2));
		await fs.mkdir(tmpDir, {recursive: true});
	});

	afterEach(async () => {
		await fs.rm(tmpDir, {recursive: true, force: true});
	});

	it('should scaffold and pass CI for web-vanilla template', async () => {
		process.env['DEBUG'] = 'create-template-project:*';
		const projectName = 'web-vanilla-e2e';
		const opts: any = {
			template: 'web-vanilla' as const,
			projectName,
			packageManager: 'pnpm',
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
			installDependencies: true,
			build: true,
			silent: true,
		};

		try {
			await generateProject(opts);
		} catch (e: any) {
			console.error('\n' + '='.repeat(80));
			console.error('INTEGRATION TEST FAILURE: web-vanilla');
			console.error('='.repeat(80));
			console.error(e.message);
			console.error('='.repeat(80) + '\n');
			throw e;
		}

		const projectPath = path.join(tmpDir, projectName);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'dist/index.html'))).toBe(true);
	}, 300000);
});
