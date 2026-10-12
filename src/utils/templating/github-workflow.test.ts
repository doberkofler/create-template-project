import {readFileSync} from 'node:fs';

import {type ProjectOptions} from '#shared/types.js';
import {describe, expect, it} from 'vitest';

import {githubWorkflowProcessor} from './github-workflow.js';

describe('github workflow processor', () => {
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

	it('should return original content if not a workflow file', () => {
		const content = 'Original Content';
		expect(githubWorkflowProcessor(content, {filePath: 'any.txt', opts: baseOpts, addedDeps: []})).toBe(content);
	});

	it('should replace installCommand for npm', () => {
		const content = '{{installCommand}}';
		expect(githubWorkflowProcessor(content, {filePath: '.github/workflows/ci.yml', opts: baseOpts, addedDeps: []})).toBe('npm ci');
	});

	it('should replace installCommand for pnpm', () => {
		const content = '{{installCommand}}';
		const opts = {...baseOpts, packageManager: 'pnpm' as const};
		expect(githubWorkflowProcessor(content, {filePath: '.github/workflows/ci.yml', opts, addedDeps: []})).toBe('pnpm install --frozen-lockfile');
	});

	it('should replace updateCommand for npm', () => {
		const content = '{{updateCommand}}';
		expect(githubWorkflowProcessor(content, {filePath: '.github/workflows/update-dependencies.yml', opts: baseOpts, addedDeps: []})).toBe(
			'npx --yes npm-check-updates -u && npm install',
		);
	});

	it('should replace updateCommand for pnpm', () => {
		const content = '{{updateCommand}}';
		const opts = {...baseOpts, packageManager: 'pnpm' as const};
		expect(githubWorkflowProcessor(content, {filePath: '.github/workflows/update-dependencies.yml', opts, addedDeps: []})).toBe('pnpm up --latest');
	});

	it('should replace updateCommand for yarn', () => {
		const content = '{{updateCommand}}';
		const opts = {...baseOpts, packageManager: 'yarn' as const};
		expect(githubWorkflowProcessor(content, {filePath: '.github/workflows/update-dependencies.yml', opts, addedDeps: []})).toBe('yarn up');
	});

	it('should handle PM_SETUP for pnpm', () => {
		const content = '# [PM_SETUP]';
		const opts = {...baseOpts, packageManager: 'pnpm' as const};
		const processed = githubWorkflowProcessor(content, {filePath: '.github/workflows/ci.yml', opts, addedDeps: []});
		expect(processed).toContain('uses: pnpm/action-setup@v6');
		expect(processed).toContain('version: latest');
	});

	it('should explicitly configure pnpm in the repository CI workflow', () => {
		const workflow = readFileSync(new URL('../../../.github/workflows/node.js.yml', import.meta.url), 'utf8');
		expect(workflow).toContain('uses: pnpm/action-setup@v6\n        with:\n          version: latest');
	});

	it('should remove PM_SETUP if not pnpm', () => {
		const content = '      # [PM_SETUP]\n      - name: Next';
		const processed = githubWorkflowProcessor(content, {filePath: '.github/workflows/ci.yml', opts: baseOpts, addedDeps: []});
		expect(processed).not.toContain('# [PM_SETUP]');
		expect(processed).toContain('- name: Next');
	});

	it('should handle PLAYWRIGHT_SETUP for web templates', () => {
		const content = '# [PLAYWRIGHT_SETUP]';
		const opts = {...baseOpts, template: 'web-app' as const};
		const processed = githubWorkflowProcessor(content, {filePath: '.github/workflows/ci.yml', opts, addedDeps: []});
		expect(processed).toContain('npx playwright install --with-deps chromium');
	});

	it('should remove PLAYWRIGHT_SETUP for cli template', () => {
		const content = '      # [PLAYWRIGHT_SETUP]\n      - name: Next';
		const processed = githubWorkflowProcessor(content, {filePath: '.github/workflows/ci.yml', opts: baseOpts, addedDeps: []});
		expect(processed).not.toContain('# [PLAYWRIGHT_SETUP]');
		expect(processed).toContain('- name: Next');
	});
});
