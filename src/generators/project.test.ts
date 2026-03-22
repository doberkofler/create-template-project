import {describe, it, expect, vi, beforeEach} from 'vitest';
import {generateProject} from './project.js';
import fs from 'node:fs/promises';
import {execa} from 'execa';

const pathExists = (p: string) =>
	fs
		.access(p)
		.then(() => true)
		.catch(() => false);
import path from 'node:path';
import os from 'node:os';
import * as p from '@clack/prompts';
import {getBaseTemplate} from '../templates/base/index.js';
import {isSeedFile} from '../utils/file.js';

const spinnerMock = {
	start: vi.fn(),
	stop: vi.fn(),
	message: vi.fn(),
};

vi.mock('execa');
vi.mock('@clack/prompts', async (importOriginal) => {
	const actual: any = await importOriginal();
	return {
		...actual,
		intro: vi.fn(),
		outro: vi.fn(),
		select: vi.fn(),
		text: vi.fn(),
		confirm: vi.fn(),
		isCancel: vi.fn(),
		cancel: vi.fn(),
		note: vi.fn(),
		spinner: vi.fn(() => spinnerMock),
		log: {
			success: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
			info: vi.fn(),
		},
	};
});

vi.mock('../templates/base/index.js', async (importOriginal) => {
	const actual: any = await importOriginal();
	return {
		...actual,
		getBaseTemplate: vi.fn(actual.getBaseTemplate),
	};
});

describe('generateProject', () => {
	const tmpDir = path.join(os.tmpdir(), 'create-template-project-test-' + Math.random().toString(36).slice(2));

	beforeEach(async () => {
		vi.clearAllMocks();
		const actual = (await vi.importActual('../templates/base/index.js')) as {getBaseTemplate: any};
		vi.mocked(getBaseTemplate).mockImplementation(actual.getBaseTemplate);
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string) => {
			if (cmd === 'npm' || cmd === 'pnpm' || cmd === 'yarn' || cmd === 'git' || cmd === 'gh') {
				return {stdout: '', stderr: ''};
			}
			return {stdout: '', stderr: ''};
		});
		await fs.mkdir(tmpDir, {recursive: true});
	});

	it('should scaffold a cli project correctly', async () => {
		const projectName = 'test-cli-project';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'cli' as const,
			projectName,
			createGithubRepository: true,
			directory: projectPath,
			update: false,
			installDependencies: true,
			build: true,
		};
		await generateProject(opts);
		expect(await pathExists(projectPath)).toBe(true);
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.name).toBe(projectName);
		expect(pkg.bin).toBe('./dist/index.js');
		expect(pkg.dependencies).toHaveProperty('commander');
		expect(pkg.scripts['create-changelog']).toBe('conventional-changelog -p angular -i CHANGELOG.md -s -r 0');

		// Verify index.ts has hashbang
		const indexContent = await fs.readFile(path.join(projectPath, 'src/index.ts'), 'utf8');
		expect(indexContent).toContain('#!/usr/bin/env node');

		// Verify .prettierignore exists
		expect(await pathExists(path.join(projectPath, '.prettierignore'))).toBe(true);

		// Verify README.md contains project name
		const readme = await fs.readFile(path.join(projectPath, 'README.md'), 'utf8');
		expect(readme).toContain(projectName);

		// Verify Husky hooks exist and are executable (simulated by checking if chmod was called or just if file exists in test)
		expect(await pathExists(path.join(projectPath, '.husky/pre-commit'))).toBe(true);
		expect(await pathExists(path.join(projectPath, '.husky/commit-msg'))).toBe(true);

		const preCommit = await fs.readFile(path.join(projectPath, '.husky/pre-commit'), 'utf8');
		expect(preCommit).toContain('npm run ci');

		expect(execa).toHaveBeenCalledWith('git', ['init'], expect.anything());
		expect(execa).toHaveBeenCalledWith('gh', expect.anything(), expect.anything());
		expect(execa).toHaveBeenCalledWith('npm', ['install'], expect.anything());
		expect(execa).toHaveBeenCalledWith('npm', ['run', 'ci'], expect.anything());
	});

	it('should handle git init failure', async () => {
		const projectName = 'test-git-fail';
		const projectPath = path.join(tmpDir, projectName);
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'git' && args?.[0] === 'init') {
				throw new Error('git fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: false,
		};
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('git fail'));
	});

	it('should scaffold a web-vanilla project correctly', async () => {
		const projectName = 'test-web-vanilla-project';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'web-vanilla' as const,
			projectName,
			createGithubRepository: false,
			directory: projectPath,
			update: false,
		};
		await generateProject(opts);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'index.html'))).toBe(true);
	});

	it('should scaffold a web-app project correctly', async () => {
		const projectName = 'test-web-app-project';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'web-app' as const,
			projectName,
			createGithubRepository: false,
			directory: projectPath,
			update: false,
		};
		await generateProject(opts);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'src/index.tsx'))).toBe(true);
	});

	it('should scaffold a web-fullstack project correctly', async () => {
		const projectName = 'test-web-fullstack-project';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'web-fullstack' as const,
			projectName,
			createGithubRepository: false,
			directory: projectPath,
			update: false,
		};
		await generateProject(opts);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'client/vite.config.ts'))).toBe(true);

		// Verify package.json content
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.dependencies).toHaveProperty('@mui/icons-material');
		expect(pkg.dependencies).toHaveProperty('@trpc/react-query');
		expect(pkg.dependencies).not.toHaveProperty('@trpc/tanstack-react-query');
		expect(pkg.workspaces).toContain('client');
		expect(pkg.workspaces).toContain('server');
		expect(pkg.scripts['create-changelog']).toBe('conventional-changelog -p angular -i CHANGELOG.md -s -r 0');

		// Verify tsconfig.json content
		const tsconfig = await fs.readFile(path.join(projectPath, 'tsconfig.json'), 'utf8');
		expect(tsconfig).toContain('"lib": ["ES2023", "DOM", "DOM.Iterable"]');
		expect(tsconfig).toContain('"jsx": "react-jsx"');
		expect(tsconfig).toContain('"include": ["client/src/**/*", "server/src/**/*"]');

		// Verify CONTRIBUTING.md contains dependencies
		const contributing = await fs.readFile(path.join(projectPath, 'CONTRIBUTING.md'), 'utf8');
		expect(contributing).toContain('## Dependencies');
		expect(contributing).toContain('express');
	});

	it('should warn and use empty version if dependency is missing in config', async () => {
		const projectName = 'test-missing-dep';
		const projectPath = path.join(tmpDir, projectName);
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {'missing-dep': ''},
			devDependencies: {},
			scripts: {},
			files: [],
			templateDir: undefined,
		} as any);
		const opts: any = {template: 'cli' as const, projectName, directory: projectPath, update: false};
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Dependency "missing-dep" not found'));
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.dependencies).toHaveProperty('missing-dep', '');
	});

	it('should handle pnpm workspaces correctly', async () => {
		const projectName = 'test-pnpm-workspaces';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'web-fullstack' as const,
			projectName,
			packageManager: 'pnpm' as const,
			directory: projectPath,
			update: false,
		};
		await generateProject(opts);

		// Verify package.json does NOT have workspaces
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.workspaces).toBeUndefined();

		// Verify pnpm-workspace.yaml exists
		const workspaceYaml = await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8');
		expect(workspaceYaml).toContain("- 'client'");
		expect(workspaceYaml).toContain("- 'server'");

		// Verify Husky pre-commit uses pnpm
		const preCommit = await fs.readFile(path.join(projectPath, '.husky/pre-commit'), 'utf8');
		expect(preCommit).toContain('pnpm run ci');

		// Verify scripts are updated
		expect(pkg.scripts.build).toBe('pnpm -r run build');
		expect(pkg.scripts.dev).toBe('pnpm -r run dev');
	});

	it('should handle --overwrite flag', async () => {
		const projectName = 'test-overwrite-project';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'old-file.txt'), 'old');
		const opts: any = {
			template: 'cli' as const,
			projectName,
			createGithubRepository: false,
			directory: projectPath,
			update: false,
			overwrite: true,
		};
		await generateProject(opts);
		expect(await pathExists(path.join(projectPath, 'old-file.txt'))).toBe(false);
	});

	it('should handle --update flag', async () => {
		const projectName = 'test-update-project';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'package.json'), JSON.stringify({name: projectName, version: '1.0.0'}));
		const opts: any = {
			template: 'cli' as const,
			projectName,
			createGithubRepository: false,
			directory: projectPath,
			update: true,
		};
		await generateProject(opts);
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.version).toBe('1.0.0');
	});

	it('should handle gh repo create failure', async () => {
		const projectName = 'test-github-fail';
		const projectPath = path.join(tmpDir, projectName);
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'gh' && args?.[0] === 'repo') {
				throw new Error('GH failed');
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			createGithubRepository: true,
			directory: projectPath,
			update: false,
		};
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to create GitHub repository'));
	});

	it('should handle merge conflicts', async () => {
		const projectName = 'test-merge-conflict';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'README.md'), 'old');
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'git' && args?.[0] === 'merge-file') {
				const err = new Error('conflict');
				(err as any).exitCode = 1;
				throw err;
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: true,
		};
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Conflict: README.md'));
	});

	it('should handle other merge errors', async () => {
		const projectName = 'test-merge-error';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'README.md'), 'old');
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'git' && args?.[0] === 'merge-file') {
				throw new Error('fatal');
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: true,
		};
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Failed to merge'));
	});

	it('should handle ci script failure', async () => {
		const projectName = 'test-ci-fail';
		const projectPath = path.join(tmpDir, projectName);
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'npm' && args?.[1] === 'ci') {
				throw new Error('fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: false,
			build: true,
		};
		await expect(generateProject(opts)).rejects.toThrow(/Failed to run CI script:?/);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('fail'));
	});

	it('should skip git init if already exists', async () => {
		const projectName = 'test-git-exists';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(path.join(projectPath, '.git'), {recursive: true});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: true,
		};
		await generateProject(opts);
		expect(execa).not.toHaveBeenCalledWith('git', ['init'], expect.anything());
	});

	it('should handle programmatic files', async () => {
		const projectName = 'test-prog';
		const projectPath = path.join(tmpDir, projectName);
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'p.txt', content: 'hello'}],
			templateDir: undefined,
		} as any);
		const opts: any = {template: 'cli' as const, projectName, directory: projectPath, update: false};
		await generateProject(opts);
		expect(await fs.readFile(path.join(projectPath, 'p.txt'), 'utf8')).toBe('hello');
	});

	it('should handle programmatic update merge', async () => {
		const projectName = 'test-prog-update';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'p.txt'), 'old');
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'p.txt', content: 'new'}],
			templateDir: undefined,
		} as any);
		const opts: any = {template: 'cli' as const, projectName, directory: projectPath, update: true};
		await generateProject(opts);
		expect(execa).toHaveBeenCalledWith('git', ['merge-file', path.join(projectPath, 'p.txt'), expect.anything(), expect.anything()], expect.anything());
	});

	it('should skip programmatic files if identical', async () => {
		const projectName = 'test-prog-ident';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'p.txt'), 'same');
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'p.txt', content: 'same'}],
			templateDir: undefined,
		} as any);
		const opts: any = {template: 'cli' as const, projectName, directory: projectPath, update: true};
		await generateProject(opts);
		expect(execa).not.toHaveBeenCalledWith('git', ['merge-file', expect.anything(), expect.anything(), expect.anything()]);
	});

	it('should handle npm install failure', async () => {
		const projectName = 'test-inst-fail';
		const projectPath = path.join(tmpDir, projectName);
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string) => {
			if (cmd === 'npm') {
				throw new Error('inst fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {template: 'cli' as const, projectName, directory: projectPath, update: false, installDependencies: true};
		await expect(generateProject(opts)).rejects.toThrow(/Failed to install dependencies:?/);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('inst fail'));
	});

	it('should handle prettier-write failure', async () => {
		const projectName = 'test-prettier-fail';
		const projectPath = path.join(tmpDir, projectName);
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'npm' && args?.[1] === 'prettier-write') {
				throw new Error('prettier fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: false,
			build: true,
		};
		// We need to make sure prettier-write script exists in the package
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {
				'prettier-write': 'prettier --write .',
				ci: 'npm run lint && npm run test',
			},
			files: [],
			templateDir: undefined,
		} as any);

		await generateProject(opts);
		// Should NOT throw but log error
		expect(spinnerMock.stop).toHaveBeenCalledWith('Failed to format files.');
	});

	it('should handle programmatic update conflict', async () => {
		const projectName = 'test-prog-conflict';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'p.txt'), 'old');
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'p.txt', content: 'new'}],
			templateDir: undefined,
		} as any);
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'git' && args?.[0] === 'merge-file') {
				const err = new Error('conflict');
				(err as any).exitCode = 1;
				throw err;
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {template: 'cli' as const, projectName, directory: projectPath, update: true};
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Conflict: p.txt'));
	});

	it('should handle dev server failure without open', async () => {
		const projectName = 'test-dev-fail-no-open';
		const projectPath = path.join(tmpDir, projectName);
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'npm' && args?.[1] === 'dev') {
				throw new Error('dev fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {template: 'cli' as const, projectName, directory: projectPath, update: false, dev: true, open: false};
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {
				dev: 'node index.js',
			},
			files: [],
			templateDir: undefined,
		} as any);
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('dev fail'));
	});

	it('should handle programmatic update returning updated', async () => {
		const projectName = 'test-prog-updated';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'p.txt'), 'old');
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'p.txt', content: 'new'}],
			templateDir: undefined,
		} as any);
		// Mock file write after git merge-file to match template
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'git' && args?.[0] === 'merge-file') {
				await fs.writeFile(args[1], 'new');
				return {stdout: '', stderr: ''};
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {template: 'cli' as const, projectName, directory: projectPath, update: true};
		await generateProject(opts);
		expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Updated: p.txt'));
	});

	it('should throw if directory exists and no update/overwrite', async () => {
		const projectName = 'test-exists-error';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		const opts: any = {template: 'cli' as const, projectName, directory: projectPath, update: false};
		await expect(generateProject(opts)).rejects.toThrow('already exists');
	});

	it('should transform npm scripts to yarn correctly', async () => {
		const projectName = 'test-yarn-scripts';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'cli' as const,
			projectName,
			packageManager: 'yarn' as const,
			directory: projectPath,
			update: false,
		};
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {
				test: 'npm run lint && npm run test',
			},
			files: [],
			templateDir: undefined,
		} as any);
		await generateProject(opts);
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.scripts.test).toBe('yarn run lint && yarn run test');
	});

	it('should show the correct summary message', async () => {
		const projectName = 'test-summary';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: false,
		};
		await generateProject(opts);
		expect(p.note).toHaveBeenCalledWith(expect.stringContaining(`Successfully created a new cli project named '${projectName}'.`));
	});

	it('should not show summary when progress is false', async () => {
		const projectName = 'test-no-summary-no-progress';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: false,
			progress: false,
		};
		await generateProject(opts);
		expect(p.note).not.toHaveBeenCalled();
	});

	it('should not show progress when progress is false', async () => {
		const projectName = 'test-no-progress';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: projectPath,
			update: false,
			progress: false,
			installDependencies: true,
		};
		await generateProject(opts);
		expect(spinnerMock.start).not.toHaveBeenCalled();
		expect(p.note).not.toHaveBeenCalled();
	});

	it('should transform npm scripts to pnpm correctly', async () => {
		const projectName = 'test-pnpm-scripts';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'web-fullstack' as const,
			projectName,
			packageManager: 'pnpm' as const,
			directory: projectPath,
			update: false,
		};
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {
				test: 'npm run test --workspaces',
				build: 'npm run build --workspaces',
			},
			workspaces: ['client', 'server'],
			files: [],
			templateDir: undefined,
		} as any);
		await generateProject(opts);
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.scripts.test).toBe('pnpm -r run test');
		expect(pkg.scripts.build).toBe('pnpm -r run build');
		expect(pkg.workspaces).toBeUndefined(); // Deleted for pnpm
	});

	it('should handle deleting files during update if no longer required', async () => {
		const projectName = 'delete-update-test';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		// Create a file that should be deleted (e.g., vitest.config.ts for cli template)
		await fs.writeFile(path.join(projectPath, 'vitest.config.ts'), 'content');

		const opts: any = {
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
			progress: false,
		};

		await generateProject(opts);
		expect(await pathExists(path.join(projectPath, 'vitest.config.ts'))).toBe(false);
	});

	it('should handle deleting programmatic files during update if no longer required', async () => {
		const projectName = 'delete-prog-update-test';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		// vitest.config.ts is NOT required for cli
		await fs.writeFile(path.join(projectPath, 'vitest.config.ts'), 'content');

		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'vitest.config.ts', content: 'test'}],
			templateDir: undefined,
		} as any);

		const opts: any = {
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
			progress: false,
		};

		await generateProject(opts);
		expect(await pathExists(path.join(projectPath, 'vitest.config.ts'))).toBe(false);
	});

	it('should handle skipping seed files during update', async () => {
		const projectName = 'skip-seed-test';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.mkdir(path.join(projectPath, 'src'), {recursive: true});
		await fs.writeFile(path.join(projectPath, 'src/main.ts'), 'my code');

		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'src/main.ts', content: 'template code'}],
			templateDir: undefined,
		} as any);

		const opts: any = {
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
			progress: false,
		};

		await generateProject(opts);
		const content = await fs.readFile(path.join(projectPath, 'src/main.ts'), 'utf8');
		expect(content).toBe('my code');
	});

	it('should handle updating pnpm-workspace.yaml when content changes', async () => {
		const projectName = 'pnpm-ws-update-test';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'old content');

		const opts: any = {
			template: 'web-fullstack',
			projectName,
			packageManager: 'pnpm',
			directory: projectPath,
			update: true,
			progress: false,
		};

		await generateProject(opts);
		const content = await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8');
		expect(content).toContain('packages:');
		expect(content).not.toBe('old content');
	});

	it('should handle dev server with --open', async () => {
		const projectName = 'dev-open-test';
		const projectPath = path.join(tmpDir, projectName);
		const opts: any = {
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
			dev: true,
			open: true,
			progress: false,
		};

		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {dev: 'node index.js'},
			files: [],
			templateDir: undefined,
		} as any);

		await generateProject(opts);
		expect(execa).toHaveBeenCalledWith('npm', ['run', 'dev', '--', '--open'], expect.anything());
	});

	it('should cover isSeedFile branches', () => {
		expect(isSeedFile('src/index.ts')).toBe(true);
		expect(isSeedFile('client/src/main.ts')).toBe(true);
		expect(isSeedFile('server/src/main.ts')).toBe(true);
		expect(isSeedFile('backend/src/main.ts')).toBe(true);
		expect(isSeedFile('frontend/src/main.ts')).toBe(true);
		expect(isSeedFile('index.html')).toBe(true);
		expect(isSeedFile('App.tsx')).toBe(true);
		expect(isSeedFile('main.tsx')).toBe(true);
		expect(isSeedFile('index.tsx')).toBe(true);
		expect(isSeedFile('package.json')).toBe(false);
		expect(isSeedFile('src.ts')).toBe(false);
	});
});
