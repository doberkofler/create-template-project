import {describe, it, expect} from 'vitest';
import {genericProcessor} from './generic.js';
import {ProjectOptions} from '../../types.js';

describe('generic processor', () => {
	const baseOpts: ProjectOptions = {
		projectName: 'test-project',
		template: 'cli',
		author: 'Test Author',
		githubUsername: 'testuser',
		directory: './test-project',
		packageManager: 'npm',
		createGithubRepository: false,
		update: false,
		installDependencies: false,
		build: false,
		progress: false,
	};

	it('should replace projectName', () => {
		expect(genericProcessor('{{projectName}}', {filePath: 'any', opts: baseOpts, addedDeps: []})).toBe('test-project');
	});

	it('should replace author', () => {
		expect(genericProcessor('{{author}}', {filePath: 'any', opts: baseOpts, addedDeps: []})).toBe('Test Author');
	});

	it('should replace githubUsername', () => {
		expect(genericProcessor('{{githubUsername}}', {filePath: 'any', opts: baseOpts, addedDeps: []})).toBe('testuser');
	});

	it('should replace year', () => {
		const year = new Date().getFullYear().toString();
		expect(genericProcessor('{{year}}', {filePath: 'any', opts: baseOpts, addedDeps: []})).toBe(year);
	});

	it('should handle packageManager correctly for lockfileRules (npm)', () => {
		expect(genericProcessor('{{lockfileRules}}', {filePath: 'any', opts: baseOpts, addedDeps: []})).toBe('yarn.lock\npnpm-lock.yaml');
	});

	it('should handle packageManager correctly for lockfileRules (pnpm)', () => {
		const opts = {...baseOpts, packageManager: 'pnpm' as const};
		expect(genericProcessor('{{lockfileRules}}', {filePath: 'any', opts, addedDeps: []})).toBe('package-lock.json\nyarn.lock');
	});

	it('should handle packageManager correctly for lockfileRules (yarn)', () => {
		const opts = {...baseOpts, packageManager: 'yarn' as const};
		expect(genericProcessor('{{lockfileRules}}', {filePath: 'any', opts, addedDeps: []})).toBe('package-lock.json\npnpm-lock.yaml');
	});

	it('should provide default description for cli', () => {
		expect(genericProcessor('{{description}}', {filePath: 'any', opts: baseOpts, addedDeps: []})).toBe(
			'A modern Node.js CLI application with TypeScript and automated tooling.',
		);
	});

	it('should provide default description for web-vanilla', () => {
		const opts = {...baseOpts, template: 'web-vanilla' as const};
		expect(genericProcessor('{{description}}', {filePath: 'any', opts, addedDeps: []})).toBe('A standalone web page/application for modern browsers.');
	});

	it('should provide default description for web-app', () => {
		const opts = {...baseOpts, template: 'web-app' as const};
		expect(genericProcessor('{{description}}', {filePath: 'any', opts, addedDeps: []})).toBe('A React application with MUI and TanStack Query.');
	});

	it('should provide default description for web-fullstack', () => {
		const opts = {...baseOpts, template: 'web-fullstack' as const};
		expect(genericProcessor('{{description}}', {filePath: 'any', opts, addedDeps: []})).toBe(
			'A full-stack monorepo with an Express server and a React/MUI client.',
		);
	});
});
