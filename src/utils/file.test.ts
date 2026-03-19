import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {getAllFiles, isSeedFile, mergeFile, mergePackageJson, processContent} from './file.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execa} from 'execa';

vi.mock('execa');

describe('file utils', () => {
	const tmpDir = path.join(os.tmpdir(), 'create-template-project-utils-test-' + Math.random().toString(36).slice(2));

	beforeEach(async () => {
		await fs.mkdir(tmpDir, {recursive: true});
		vi.clearAllMocks();
	});

	afterEach(async () => {
		await fs.rm(tmpDir, {recursive: true, force: true});
	});

	describe('getAllFiles', () => {
		it('should list all files recursively', async () => {
			await fs.mkdir(path.join(tmpDir, 'subdir'), {recursive: true});
			await fs.writeFile(path.join(tmpDir, 'file1.txt'), 'content1');
			await fs.writeFile(path.join(tmpDir, 'subdir/file2.txt'), 'content2');

			const files = await getAllFiles(tmpDir);
			expect(files).toHaveLength(2);
			expect(files.map((f) => path.normalize(f))).toContain(path.normalize(path.join(tmpDir, 'file1.txt')));
			expect(files.map((f) => path.normalize(f))).toContain(path.normalize(path.join(tmpDir, 'subdir/file2.txt')));
		});

		it('should return empty array for empty directory', async () => {
			const files = await getAllFiles(tmpDir);
			expect(files).toHaveLength(0);
		});
	});

	describe('isSeedFile', () => {
		it('should identify seed files correctly', () => {
			expect(isSeedFile('src/index.ts')).toBe(true);
			expect(isSeedFile('client/src/App.tsx')).toBe(true);
			expect(isSeedFile('index.html')).toBe(true);
			expect(isSeedFile('package.json')).toBe(false);
			expect(isSeedFile('README.md')).toBe(false);
		});
	});

	describe('mergePackageJson', () => {
		it('should merge package.json parts correctly', () => {
			const target: any = {
				scripts: {test: 'old'},
				dependencies: {dep1: '1.0.0'},
			};
			const source: any = {
				scripts: {build: 'new'},
				dependencies: {dep2: '2.0.0'},
				devDependencies: {dev1: '3.0.0'},
				workspaces: ['client'],
			};

			mergePackageJson(target, source);

			expect(target.scripts).toEqual({test: 'old', build: 'new'});
			expect(target.dependencies).toEqual({dep1: '1.0.0', dep2: '2.0.0'});
			expect(target.devDependencies).toEqual({dev1: '3.0.0'});
			expect(target.workspaces).toEqual(['client']);
		});
	});

	describe('processContent', () => {
		const opts: any = {
			projectName: 'test-project',
			template: 'cli',
		};

		it('should replace placeholders', () => {
			const content = 'Project: {{projectName}}, Description: {{description}}';
			const processed = processContent('README.md', content, opts, []);
			expect(processed).toContain('Project: test-project');
			expect(processed).toContain('A modern Node.js CLI application');
		});

		it('should append unique dependencies to CONTRIBUTING.md', () => {
			const content = '# Contributing';
			const addedDeps = [
				{name: 'dep1', description: 'desc1'},
				{name: 'dep1', description: 'desc1'},
				{name: 'dep2', description: 'desc2'},
			];
			const processed = processContent('CONTRIBUTING.md', content, opts, addedDeps);
			expect(processed).toContain('## Dependencies');
			expect(processed).toContain('- **dep1**: desc1');
			expect(processed).toContain('- **dep2**: desc2');
			const occurrences = (processed.match(/dep1/g) || []).length;
			expect(occurrences).toBe(1);
		});

		it('should handle webpage script tag index.html', () => {
			const content = '<script src="{{scriptSrc}}"></script>';
			const optsWebpage: any = {...opts, template: 'webpage', skipBuild: true};
			const processed = processContent('index.html', content, optsWebpage, []);
			expect(processed).toContain('./src/index.js');
		});

		it('should handle fullstack tsconfig.json overrides', () => {
			const content = '/* Language and Environment */ "lib": ["ESNext"], "module": "NodeNext" /* Strict Type-Checking Options */, "include": ["src/**/*"]';
			const optsFullstack: any = {...opts, template: 'fullstack'};
			const processed = processContent('tsconfig.json', content, optsFullstack, []);
			expect(processed).toContain('"lib": ["ES2023", "DOM", "DOM.Iterable"]');
			expect(processed).toContain('"jsx": "react-jsx"');
			expect(processed).toContain('"include": ["client/src/**/*", "server/src/**/*"]');
		});
	});

	describe('mergeFile', () => {
		it('should return updated if content matches template', async () => {
			const filePath = path.join(tmpDir, 'file.txt');
			await fs.writeFile(filePath, 'template content');
			const log = {error: vi.fn()};

			const result = await mergeFile(filePath, 'old content', 'template content', log);
			expect(result).toBe('updated');
		});

		it('should return merged if git merge-file succeeds with changes', async () => {
			const filePath = path.join(tmpDir, 'file.txt');
			await fs.writeFile(filePath, 'merged content');
			(vi.mocked(execa) as any).mockResolvedValue({exitCode: 0});
			const log = {error: vi.fn()};

			const result = await mergeFile(filePath, 'old content', 'template content', log);
			expect(result).toBe('merged');
			expect(execa).toHaveBeenCalledWith('git', ['merge-file', filePath, expect.any(String), expect.any(String)], {preferLocal: true});
		});

		it('should return conflict if git merge-file returns exit code 1', async () => {
			const filePath = path.join(tmpDir, 'file.txt');
			const err: any = new Error('conflict');
			err.exitCode = 1;
			(vi.mocked(execa) as any).mockRejectedValue(err);
			const log = {error: vi.fn()};

			const result = await mergeFile(filePath, 'old content', 'template content', log);
			expect(result).toBe('conflict');
		});

		it('should return error and log message on other git failures', async () => {
			const filePath = path.join(tmpDir, 'file.txt');
			const err: any = new Error('fatal error');
			err.exitCode = 128;
			(vi.mocked(execa) as any).mockRejectedValue(err);
			const log = {error: vi.fn()};

			const result = await mergeFile(filePath, 'old content', 'template content', log);
			expect(result).toBe('error');
			expect(log.error).toHaveBeenCalledWith(expect.stringContaining('fatal error'));
		});
	});
});
