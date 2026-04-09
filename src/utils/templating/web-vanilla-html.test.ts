import {describe, it, expect} from 'vitest';
import {webVanillaHtmlProcessor} from './web-vanilla-html.js';
import {type ProjectOptions} from '#shared/types.js';

describe('web vanilla html processor', () => {
	const baseOpts: ProjectOptions = {
		projectName: 'test-project',
		template: 'web-vanilla',
		author: 'Test Author',
		githubUsername: 'testuser',
		directory: './test-project',
		packageManager: 'npm',
		createGithubRepository: false,
		update: false,
		build: false,
		progress: false,
	};

	it('should replace scriptSrc in index.html for web-vanilla', () => {
		const content = '<script src="{{scriptSrc}}"></script>';
		const processed = webVanillaHtmlProcessor(content, {filePath: 'index.html', opts: baseOpts, addedDeps: []});
		expect(processed).toBe('<script src="/src/index.ts"></script>');
	});

	it('should return original content if not index.html', () => {
		const content = 'Original Content';
		expect(webVanillaHtmlProcessor(content, {filePath: 'any.html', opts: baseOpts, addedDeps: []})).toBe(content);
	});

	it('should return original content if template is not web-vanilla', () => {
		const content = '<script src="{{scriptSrc}}"></script>';
		const opts = {...baseOpts, template: 'cli' as const};
		expect(webVanillaHtmlProcessor(content, {filePath: 'index.html', opts, addedDeps: []})).toBe(content);
	});
});
