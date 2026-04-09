import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {getAllFiles, isSeedFile, mergeFile, mergePackageJson, processContent} from '#shared/file.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execa} from 'execa';

vi.mock(import('execa'));

type ProjectOptions = Parameters<typeof processContent>[2];

type MergeablePackageJson = {
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	workspaces?: string[];
	bin?: string;
};

const baseOptions: ProjectOptions = {
	template: 'cli',
	projectName: 'test-project',
	author: 'Test Author',
	githubUsername: 'test-user',
	packageManager: 'pnpm',
	createGithubRepository: false,
	directory: '/tmp/test-project',
	update: false,
	build: false,
	progress: false,
};

const createExecaError = (message: string, exitCode: number): Error & {exitCode: number} => Object.assign(new Error(message), {exitCode});

const setExecaMockImplementation = (implementation: (...args: unknown[]) => unknown): void => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	(vi.mocked(execa) as unknown as {mockImplementation: (fn: (...args: unknown[]) => unknown) => void}).mockImplementation(implementation);
};

describe('file utils', () => {
	const tmpDir = path.join(os.tmpdir(), `create-template-project-utils-test-${Math.random().toString(36).slice(2)}`);

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
			expect(isSeedFile('package.json')).not.toBe(true);
			expect(isSeedFile('README.md')).toBe(true);
		});
	});

	describe('mergePackageJson', () => {
		it('should merge package.json parts correctly', () => {
			const target: MergeablePackageJson = {
				scripts: {test: 'old'},
				dependencies: {dep1: '1.0.0'},
			};
			const source: MergeablePackageJson = {
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
		const opts = baseOptions;

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
			const occurrences = (processed.match(/dep1/g) ?? []).length;
			expect(occurrences).toBe(1);
		});

		it('should handle web-vanilla script tag index.html', () => {
			const content = '<script src="{{scriptSrc}}"></script>';
			const optsWebpage: ProjectOptions = {...opts, template: 'web-vanilla'};
			const processed = processContent('index.html', content, optsWebpage, []);
			expect(processed).toContain('/src/index.ts');
		});

		it('should handle web-fullstack tsconfig.json overrides', () => {
			const content = '/* Language and Environment */ "lib": ["ESNext"], "module": "NodeNext" /* Strict Type-Checking Options */, "include": ["src/**/*"]';
			const optsFullstack: ProjectOptions = {...opts, template: 'web-fullstack'};
			const processed = processContent('tsconfig.json', content, optsFullstack, []);
			expect(processed).toContain('"lib": ["ES2023", "DOM", "DOM.Iterable"]');
			expect(processed).toContain('"jsx": "react-jsx"');
			expect(processed).toContain('"include": ["client/src/**/*", "server/src/**/*"]');
		});

		it('should handle GitHub Actions workflow generation for web-fullstack with pnpm', () => {
			const content = `
    steps:
      - uses: actions/checkout@v4
      # [PM_SETUP]
      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: "{{packageManager}}"
      - run: "{{installCommand}}"
      # [PLAYWRIGHT_SETUP]
      - run: "{{packageManager}} run ci"
`;
			const optsFullstack: ProjectOptions = {...opts, template: 'web-fullstack', packageManager: 'pnpm'};
			const processed = processContent('.github/workflows/node.js.yml', content, optsFullstack, []);
			expect(processed).toContain('uses: pnpm/action-setup@v4');
			expect(processed).toContain('cache: "pnpm"');
			expect(processed).toContain('run: "pnpm install --frozen-lockfile"');
			expect(processed).toContain('name: Install Playwright Browsers & Deps');
			expect(processed).toContain('run: "pnpm run ci"');
		});

		it('should handle GitHub Actions workflow generation for cli with npm', () => {
			const content = `
    steps:
      - uses: actions/checkout@v4
      # [PM_SETUP]
      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ' ESNext'
          cache: "{{packageManager}}"
      - run: "{{installCommand}}"
      # [PLAYWRIGHT_SETUP]
      - run: "{{packageManager}} run ci"
`;
			const optsCli: ProjectOptions = {...opts, template: 'cli', packageManager: 'npm'};
			const processed = processContent('.github/workflows/node.js.yml', content, optsCli, []);
			expect(processed).not.toContain('uses: pnpm/action-setup@v4');
			expect(processed).not.toContain('# [PM_SETUP]');
			expect(processed).toContain('cache: "npm"');
			expect(processed).toContain('run: "npm ci"');
			expect(processed).not.toContain('name: Install Playwright Browsers & Deps');
			expect(processed).not.toContain('# [PLAYWRIGHT_SETUP]');
			expect(processed).toContain('run: "npm run ci"');
		});

		it('should handle GitHub Actions workflow generation for web-app with yarn', () => {
			const content = `
    steps:
      - uses: actions/checkout@v4
      # [PM_SETUP]
      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: "{{packageManager}}"
      - run: "{{installCommand}}"
      # [PLAYWRIGHT_SETUP]
      - run: "{{packageManager}} run ci"
`;
			const optsWebApp: ProjectOptions = {...opts, template: 'web-app', packageManager: 'yarn'};
			const processed = processContent('.github/workflows/node.js.yml', content, optsWebApp, []);
			expect(processed).not.toContain('uses: pnpm/action-setup@v4');
			expect(processed).toContain('cache: "yarn"');
			expect(processed).toContain('run: "yarn install --frozen-lockfile"');
			expect(processed).toContain('name: Install Playwright Browsers & Deps');
			expect(processed).toContain('run: "yarn run ci"');
		});

		it('should handle GitHub Actions workflow generation for cli with npm', () => {
			const content = `
    steps:
      - uses: actions/checkout@v4
      # [PM_SETUP]
      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: "{{packageManager}}"
      - run: "{{installCommand}}"
      # [PLAYWRIGHT_SETUP]
      - run: "{{packageManager}} run ci"
`;
			const optsCli: ProjectOptions = {...opts, template: 'cli', packageManager: 'npm'};
			const processed = processContent('.github/workflows/node.js.yml', content, optsCli, []);
			expect(processed).not.toContain('uses: pnpm/action-setup@v4');
			expect(processed).not.toContain('# [PM_SETUP]');
			expect(processed).toContain('cache: "npm"');
			expect(processed).toContain('run: "npm ci"');
			expect(processed).not.toContain('name: Install Playwright Browsers & Deps');
			expect(processed).not.toContain('# [PLAYWRIGHT_SETUP]');
			expect(processed).toContain('run: "npm run ci"');
		});

		it('should handle GitHub Actions workflow generation for cli with npm', () => {
			const content = `
    steps:
      - uses: actions/checkout@v4
      # [PM_SETUP]
      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: "{{packageManager}}"
      - run: "{{installCommand}}"
      # [PLAYWRIGHT_SETUP]
      - run: "{{packageManager}} run ci"
`;
			const optsCli: ProjectOptions = {...opts, template: 'cli', packageManager: 'npm'};
			const processed = processContent('.github/workflows/node.js.yml', content, optsCli, []);
			expect(processed).not.toContain('uses: pnpm/action-setup@v4');
			expect(processed).not.toContain('# [PM_SETUP]');
			expect(processed).toContain('cache: "npm"');
			expect(processed).toContain('run: "npm ci"');
			expect(processed).not.toContain('name: Install Playwright Browsers & Deps');
			expect(processed).not.toContain('# [PLAYWRIGHT_SETUP]');
			expect(processed).toContain('run: "npm run ci"');
		});
	});

	describe('mergeFile', () => {
		it('should return updated if content matches template', async () => {
			const filePath = path.join(tmpDir, 'file.txt');
			await fs.writeFile(filePath, 'template content');
			const log = {error: vi.fn<(msg: string) => void>()};

			const result = await mergeFile(filePath, 'old content', 'template content', log);
			expect(result).toBe('updated');
		});

		it('should return merged if git merge-file succeeds with changes', async () => {
			const filePath = path.join(tmpDir, 'file.txt');
			await fs.writeFile(filePath, 'merged content');
			setExecaMockImplementation(() => ({stdout: '', stderr: ''}));
			const log = {error: vi.fn<(msg: string) => void>()};

			const result = await mergeFile(filePath, 'old content', 'template content', log);
			expect(result).toBe('merged');
			expect(execa).toHaveBeenCalledWith('git', ['merge-file', filePath, expect.any(String), expect.any(String)], {preferLocal: true, stdio: 'pipe'});
		});

		it('should return conflict if git merge-file returns exit code 1', async () => {
			const filePath = path.join(tmpDir, 'file.txt');
			const err = createExecaError('conflict', 1);
			setExecaMockImplementation(() => {
				throw err;
			});
			const log = {error: vi.fn<(msg: string) => void>()};

			const result = await mergeFile(filePath, 'old content', 'template content', log);
			expect(result).toBe('conflict');
		});

		it('should return conflict if git merge-file returns exit code 2 (multiple conflicts)', async () => {
			const filePath = path.join(tmpDir, 'file.txt');
			const err = createExecaError('conflict', 2);
			setExecaMockImplementation(() => {
				throw err;
			});
			const log = {error: vi.fn<(msg: string) => void>()};

			const result = await mergeFile(filePath, 'old content', 'template content', log);
			expect(result).toBe('conflict');
		});

		it('should return error and log message on other git failures', async () => {
			const filePath = path.join(tmpDir, 'file.txt');
			const err = createExecaError('fatal error', 128);
			setExecaMockImplementation(() => {
				throw err;
			});
			const log = {error: vi.fn<(msg: string) => void>()};

			const result = await mergeFile(filePath, 'old content', 'template content', log);
			expect(result).toBe('error');
			expect(log.error).toHaveBeenCalledWith(expect.stringContaining('fatal error'));
		});
	});
});
