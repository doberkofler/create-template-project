import {describe, it, expect} from 'vitest';
import {contributingProcessor} from './contributing.js';
import {ProjectOptions} from '../../types.js';

describe('contributing processor', () => {
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

	it('should return original content if not CONTRIBUTING.md', () => {
		const content = 'Original Content';
		expect(contributingProcessor(content, {filePath: 'any.md', opts: baseOpts, addedDeps: []})).toBe(content);
	});

	it('should append dependencies to CONTRIBUTING.md', () => {
		const content = '# Contributing';
		const addedDeps = [
			{name: 'dep1', description: 'desc1'},
			{name: 'dep2', description: 'desc2'},
		];
		const processed = contributingProcessor(content, {filePath: 'CONTRIBUTING.md', opts: baseOpts, addedDeps});
		expect(processed).toContain('## Dependencies');
		expect(processed).toContain('- **dep1**: desc1');
		expect(processed).toContain('- **dep2**: desc2');
	});

	it('should NOT append if no dependencies', () => {
		const content = '# Contributing';
		const processed = contributingProcessor(content, {filePath: 'CONTRIBUTING.md', opts: baseOpts, addedDeps: []});
		expect(processed).toBe(content);
	});
});
