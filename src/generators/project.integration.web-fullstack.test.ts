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
describe('generateProject (Integration - Web-Fullstack)', () => {
	let tmpDir: string;

	beforeEach(async () => {
		tmpDir = path.join(os.tmpdir(), 'cp-integration-web-fullstack-' + Math.random().toString(36).slice(2));
		await fs.mkdir(tmpDir, {recursive: true});
	});

	afterEach(async () => {
		await fs.rm(tmpDir, {recursive: true, force: true});
	});

	it('should scaffold and pass CI for web-fullstack template', async () => {
		process.env['DEBUG'] = 'create-template-project:*';
		const projectName = 'web-fullstack-e2e';
		const opts: any = {
			template: 'web-fullstack' as const,
			projectName,
			packageManager: 'pnpm',
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
			installDependencies: true,
			build: true, // This triggers the CI script in generateProject
			silent: true,
		};

		// We don't mock execa here. It will run real npm install and npm run ci.
		try {
			await generateProject(opts);
		} catch (e: any) {
			console.error('Integration test failed!');
			console.error(e.message);
			throw e;
		}

		const projectPath = path.join(tmpDir, projectName);
		expect(await pathExists(projectPath)).toBe(true);

		// In web-fullstack, check workspace dist files
		expect(await pathExists(path.join(projectPath, 'client/dist/index.html'))).toBe(true);
		expect(await pathExists(path.join(projectPath, 'server/dist/index.js'))).toBe(true);
	}, 600000); // 10 minute timeout for npm install and build
});
