import {describe, it, expect} from 'vitest';
import {processContent} from './index.js';
import {ProjectOptions} from '../../types.js';

describe('templating orchestrator', () => {
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

	it('should apply multiple processors in order', () => {
		const content = 'Project: {{projectName}}\n# [PM_SETUP]';
		const opts: ProjectOptions = {...baseOpts, packageManager: 'pnpm'};
		const processed = processContent('.github/workflows/node.js.yml', content, opts, []);

		expect(processed).toContain('Project: test-project');
		expect(processed).toContain('uses: pnpm/action-setup@v4');
	});

	it('should handle generic replacements correctly', () => {
		const content = '{{projectName}} {{author}} {{year}}';
		const processed = processContent('any.txt', content, baseOpts, []);

		expect(processed).toContain('test-project');
		expect(processed).toContain('Test Author');
		expect(processed).toContain(new Date().getFullYear().toString());
	});

	it('should use default description when none provided', () => {
		const content = '{{description}}';
		const processed = processContent('any.txt', content, baseOpts, []);
		expect(processed).toBe('A modern Node.js CLI application with TypeScript and automated tooling.');
	});

	it('should use provided description', () => {
		const content = '{{description}}';
		const opts = {...baseOpts, description: 'Custom description'};
		const processed = processContent('any.txt', content, opts, []);
		expect(processed).toBe('Custom description');
	});
});
