import {describe, it, expect} from 'vitest';
import {githubWorkflowProcessor} from './github-workflow.js';
import {ProjectOptions} from '../../types.js';

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
		expect(githubWorkflowProcessor(content, {filePath: '.github/workflows/node.js.yml', opts: baseOpts, addedDeps: []})).toBe('npm ci');
	});

	it('should replace installCommand for pnpm', () => {
		const content = '{{installCommand}}';
		const opts = {...baseOpts, packageManager: 'pnpm' as const};
		expect(githubWorkflowProcessor(content, {filePath: '.github/workflows/node.js.yml', opts, addedDeps: []})).toBe('pnpm install --frozen-lockfile');
	});

	it('should handle PM_SETUP for pnpm', () => {
		const content = '# [PM_SETUP]';
		const opts = {...baseOpts, packageManager: 'pnpm' as const};
		const processed = githubWorkflowProcessor(content, {filePath: '.github/workflows/node.js.yml', opts, addedDeps: []});
		expect(processed).toContain('uses: pnpm/action-setup@v4');
	});

	it('should remove PM_SETUP if not pnpm', () => {
		const content = '      # [PM_SETUP]\n      - name: Next';
		const processed = githubWorkflowProcessor(content, {filePath: '.github/workflows/node.js.yml', opts: baseOpts, addedDeps: []});
		expect(processed).not.toContain('# [PM_SETUP]');
		expect(processed).toContain('- name: Next');
	});

	it('should handle PLAYWRIGHT_SETUP for web templates', () => {
		const content = '# [PLAYWRIGHT_SETUP]';
		const opts = {...baseOpts, template: 'web-app' as const};
		const processed = githubWorkflowProcessor(content, {filePath: '.github/workflows/node.js.yml', opts, addedDeps: []});
		expect(processed).toContain('npx playwright install --with-deps chromium');
	});

	it('should remove PLAYWRIGHT_SETUP for cli template', () => {
		const content = '      # [PLAYWRIGHT_SETUP]\n      - name: Next';
		const processed = githubWorkflowProcessor(content, {filePath: '.github/workflows/node.js.yml', opts: baseOpts, addedDeps: []});
		expect(processed).not.toContain('# [PLAYWRIGHT_SETUP]');
		expect(processed).toContain('- name: Next');
	});
});
