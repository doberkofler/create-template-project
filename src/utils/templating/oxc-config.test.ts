import {describe, it, expect} from 'vitest';
import {oxcConfigProcessor} from './oxc-config.js';
import {type ProjectOptions} from '#shared/types.js';

describe('oxc config processor', () => {
	const baseOpts: ProjectOptions = {
		projectName: 'test-project',
		template: 'cli',
		author: 'Test Author',
		githubUsername: 'testuser',
		directory: './test-project',
		packageManager: 'npm',
		createGithubRepository: false,
		update: false,
		build: false,
		progress: false,
	};

	const baseOxcConfig = `env: {
		builtin: true,
	},`;

	it('adds node env for cli template', () => {
		const processed = oxcConfigProcessor(baseOxcConfig, {filePath: 'oxc.config.ts', opts: baseOpts, addedDeps: []});
		expect(processed).toContain('node: true');
	});

	it('adds node env for web-fullstack template', () => {
		const opts = {...baseOpts, template: 'web-fullstack' as const};
		const processed = oxcConfigProcessor(baseOxcConfig, {filePath: 'oxc.config.ts', opts, addedDeps: []});
		expect(processed).toContain('node: true');
		expect(processed).toContain('browser: true');
	});

	it('adds browser env and not node env for web-app template', () => {
		const opts = {...baseOpts, template: 'web-app' as const};
		const processed = oxcConfigProcessor(baseOxcConfig, {filePath: 'oxc.config.ts', opts, addedDeps: []});
		expect(processed).toContain('browser: true');
		expect(processed).not.toContain('node: true');
	});

	it('adds browser env and not node env for web-vanilla template', () => {
		const opts = {...baseOpts, template: 'web-vanilla' as const};
		const processed = oxcConfigProcessor(baseOxcConfig, {filePath: 'oxc.config.ts', opts, addedDeps: []});
		expect(processed).toContain('browser: true');
		expect(processed).not.toContain('node: true');
	});

	it('does not change non-oxc files', () => {
		const processed = oxcConfigProcessor(baseOxcConfig, {filePath: 'README.md', opts: baseOpts, addedDeps: []});
		expect(processed).toBe(baseOxcConfig);
	});
});
