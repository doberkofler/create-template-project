import {describe, it, expect} from 'vitest';
import {tsconfigProcessor} from './tsconfig.js';
import {ProjectOptions} from '../../types.js';

describe('tsconfig processor', () => {
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

	it('should return original content if not tsconfig.json', () => {
		const content = 'Original Content';
		expect(tsconfigProcessor(content, {filePath: 'any.json', opts: baseOpts, addedDeps: []})).toBe(content);
	});

	it('should replace webEnv for web templates', () => {
		const content = '/* Language and Environment */\n\t\t"target": "ESNext"\n\t\t/* Strict Type-Checking Options */';
		const opts = {...baseOpts, template: 'web-app' as const};
		const processed = tsconfigProcessor(content, {filePath: 'tsconfig.json', opts, addedDeps: []});
		expect(processed).toContain('"jsx": "react-jsx"');
		expect(processed).toContain('"lib": ["ES2023", "DOM", "DOM.Iterable"]');
	});

	it('should replace include for web-fullstack', () => {
		const content = '"include": ["src/**/*"]';
		const opts = {...baseOpts, template: 'web-fullstack' as const};
		const processed = tsconfigProcessor(content, {filePath: 'tsconfig.json', opts, addedDeps: []});
		expect(processed).toContain('"include": ["client/src/**/*", "server/src/**/*"]');
	});

	it('should NOT replace include for web-app', () => {
		const content = '"include": ["src/**/*"]';
		const opts = {...baseOpts, template: 'web-app' as const};
		const processed = tsconfigProcessor(content, {filePath: 'tsconfig.json', opts, addedDeps: []});
		expect(processed).toContain('"include": ["src/**/*"]');
	});
});
