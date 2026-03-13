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
		const opts: any = {
			template: 'cli' as const,
			projectName,
			createGithubRepository: true,
			directory: tmpDir,
			update: false,
			installDependencies: true,
			build: true,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);
		expect(await pathExists(projectPath)).toBe(true);
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.name).toBe(projectName);
		expect(pkg.dependencies).toHaveProperty('commander');

		// Verify README.md contains project name
		const readme = await fs.readFile(path.join(projectPath, 'README.md'), 'utf8');
		expect(readme).toContain(projectName);

		expect(execa).toHaveBeenCalledWith('git', ['init'], expect.anything());
		expect(execa).toHaveBeenCalledWith('gh', expect.anything(), expect.anything());
		expect(execa).toHaveBeenCalledWith('npm', ['install'], expect.anything());
		expect(execa).toHaveBeenCalledWith('npm', ['run', 'ci'], expect.anything());
	});

	it('should handle git init failure', async () => {
		const projectName = 'test-git-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'git' && args?.[0] === 'init') {
				throw new Error('git fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: tmpDir,
			update: false,
		};
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('git fail'));
	});

	it('should scaffold a webpage project correctly', async () => {
		const projectName = 'test-webpage-project';
		const opts: any = {
			template: 'webpage' as const,
			projectName,
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'index.html'))).toBe(true);
	});

	it('should scaffold a webapp project correctly', async () => {
		const projectName = 'test-webapp-project';
		const opts: any = {
			template: 'webapp' as const,
			projectName,
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'backend/src/index.ts'))).toBe(true);
	});

	it('should scaffold a fullstack project correctly', async () => {
		const projectName = 'test-fullstack-project';
		const opts: any = {
			template: 'fullstack' as const,
			projectName,
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'client/tsdown.config.ts'))).toBe(true);

		// Verify package.json content
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.dependencies).toHaveProperty('@mui/icons-material');
		expect(pkg.dependencies).toHaveProperty('@trpc/react-query');
		expect(pkg.dependencies).not.toHaveProperty('@trpc/tanstack-react-query');
		expect(pkg.workspaces).toContain('client');
		expect(pkg.workspaces).toContain('server');

		// Verify tsconfig.json content
		const tsconfig = await fs.readFile(path.join(projectPath, 'tsconfig.json'), 'utf8');
		expect(tsconfig).toContain('"lib": ["ESNext", "DOM"]');
		expect(tsconfig).toContain('"jsx": "react-jsx"');
		expect(tsconfig).toContain('"include": ["client/src/**/*", "server/src/**/*"]');

		// Verify CONTRIBUTING.md contains dependencies
		const contributing = await fs.readFile(path.join(projectPath, 'CONTRIBUTING.md'), 'utf8');
		expect(contributing).toContain('## Dependencies');
		expect(contributing).toContain('express');
	});

	it('should warn and use empty version if dependency is missing in config', async () => {
		const projectName = 'test-missing-dep';
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {'missing-dep': ''},
			devDependencies: {},
			scripts: {},
			files: [],
			templateDir: undefined,
		} as any);
		const opts: any = {template: 'cli' as const, projectName, directory: tmpDir, update: false};
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Dependency "missing-dep" not found'));
		const pkg = JSON.parse(await fs.readFile(path.join(tmpDir, projectName, 'package.json'), 'utf8'));
		expect(pkg.dependencies).toHaveProperty('missing-dep', '');
	});

	it('should handle pnpm workspaces correctly', async () => {
		const projectName = 'test-pnpm-workspaces';
		const opts: any = {
			template: 'fullstack' as const,
			projectName,
			packageManager: 'pnpm' as const,
			directory: tmpDir,
			update: false,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);

		// Verify package.json does NOT have workspaces
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.workspaces).toBeUndefined();

		// Verify pnpm-workspace.yaml exists
		const workspaceYaml = await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8');
		expect(workspaceYaml).toContain("- 'client'");
		expect(workspaceYaml).toContain("- 'server'");

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
			directory: tmpDir,
			update: false,
			overwrite: true,
		};
		await generateProject(opts);
		expect(await pathExists(path.join(projectPath, 'old-file.txt'))).toBe(false);
	});

	it('should handle --skip-build flag and remove tsdown configs', async () => {
		const projectName = 'test-skip-build-cleanup';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'tsdown.config.ts'), 'content');

		const opts: any = {
			template: 'cli' as const,
			projectName,
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
			overwrite: true,
			skipBuild: true,
		};
		await generateProject(opts);
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.scripts.build).toBeUndefined();
		expect(await pathExists(path.join(projectPath, 'tsdown.config.ts'))).toBe(false);
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
			directory: tmpDir,
			update: true,
		};
		await generateProject(opts);
		const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
		expect(pkg.version).toBe('1.0.0');
	});

	it('should handle gh repo create failure', async () => {
		const projectName = 'test-github-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'gh' && args?.[0] === 'repo') throw new Error('GH failed');
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			createGithubRepository: true,
			directory: tmpDir,
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
			directory: tmpDir,
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
			if (cmd === 'git' && args?.[0] === 'merge-file') throw new Error('fatal');
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: tmpDir,
			update: true,
		};
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Failed to merge'));
	});

	it('should handle ci script failure', async () => {
		const projectName = 'test-ci-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'npm' && args?.[1] === 'ci') throw new Error('fail');
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: tmpDir,
			update: false,
			build: true,
		};
		await expect(generateProject(opts)).rejects.toThrow('Failed to run CI script.');
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('fail'));
	});

	it('should skip git init if already exists', async () => {
		const projectName = 'test-git-exists';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(path.join(projectPath, '.git'), {recursive: true});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: tmpDir,
			update: true,
		};
		await generateProject(opts);
		expect(execa).not.toHaveBeenCalledWith('git', ['init'], expect.anything());
	});

	it('should handle webpage with skipBuild', async () => {
		const projectName = 'test-webpage-skip';
		const opts: any = {
			template: 'webpage' as const,
			projectName,
			directory: tmpDir,
			update: false,
			skipBuild: true,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);
		expect(await pathExists(path.join(projectPath, 'src/index.js'))).toBe(true);
	});

	it('should handle programmatic files', async () => {
		const projectName = 'test-prog';
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'p.txt', content: 'hello'}],
			templateDir: undefined,
		} as any);
		const opts: any = {template: 'cli' as const, projectName, directory: tmpDir, update: false};
		await generateProject(opts);
		expect(await fs.readFile(path.join(tmpDir, projectName, 'p.txt'), 'utf8')).toBe('hello');
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
		const opts: any = {template: 'cli' as const, projectName, directory: tmpDir, update: true};
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
		const opts: any = {template: 'cli' as const, projectName, directory: tmpDir, update: true};
		await generateProject(opts);
		expect(execa).not.toHaveBeenCalledWith('git', ['merge-file', expect.anything(), expect.anything(), expect.anything()]);
	});

	it('should handle npm install failure', async () => {
		const projectName = 'test-inst-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string) => {
			if (cmd === 'npm') throw new Error('inst fail');
			return {stdout: '', stderr: ''};
		});
		const opts: any = {template: 'cli' as const, projectName, directory: tmpDir, update: false, installDependencies: true};
		await expect(generateProject(opts)).rejects.toThrow('Failed to install dependencies.');
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('inst fail'));
	});

	it('should handle prettier-write failure', async () => {
		const projectName = 'test-prettier-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'npm' && args?.[1] === 'prettier-write') throw new Error('prettier fail');
			return {stdout: '', stderr: ''};
		});
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: tmpDir,
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
		const opts: any = {template: 'cli' as const, projectName, directory: tmpDir, update: true};
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Conflict: p.txt'));
	});

	it('should handle dev server failure without open', async () => {
		const projectName = 'test-dev-fail-no-open';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'npm' && args?.[1] === 'dev') throw new Error('dev fail');
			return {stdout: '', stderr: ''};
		});
		const opts: any = {template: 'cli' as const, projectName, directory: tmpDir, update: false, dev: true, open: false};
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
		const opts: any = {template: 'cli' as const, projectName, directory: tmpDir, update: true};
		await generateProject(opts);
		expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Updated: p.txt'));
	});

	it('should throw if directory exists and no update/overwrite', async () => {
		const projectName = 'test-exists-error';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		const opts: any = {template: 'cli' as const, projectName, directory: tmpDir, update: false};
		await expect(generateProject(opts)).rejects.toThrow('already exists');
	});

	it('should transform npm scripts to yarn correctly', async () => {
		const projectName = 'test-yarn-scripts';
		const opts: any = {
			template: 'cli' as const,
			projectName,
			packageManager: 'yarn' as const,
			directory: tmpDir,
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
		const pkg = JSON.parse(await fs.readFile(path.join(tmpDir, projectName, 'package.json'), 'utf8'));
		expect(pkg.scripts.test).toBe('yarn run lint && yarn run test');
	});

	it('should show the correct summary message', async () => {
		const projectName = 'test-summary';
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: tmpDir,
			update: false,
		};
		await generateProject(opts);
		expect(p.note).toHaveBeenCalledWith(expect.stringContaining(`Successfully created a new cli project named '${projectName}'.`), 'Project ready');
	});

	it('should not show summary when silent', async () => {
		const projectName = 'test-silent';
		const opts: any = {
			template: 'cli' as const,
			projectName,
			directory: tmpDir,
			update: false,
			silent: true,
		};
		await generateProject(opts);
		expect(p.note).not.toHaveBeenCalled();
	});

	it('should transform npm scripts to pnpm correctly', async () => {
		const projectName = 'test-pnpm-scripts';
		const opts: any = {
			template: 'fullstack' as const,
			projectName,
			packageManager: 'pnpm' as const,
			directory: tmpDir,
			update: false,
		};
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {
				test: 'npm run lint && npm run test',
				build: 'npm run build --workspaces',
			},
			workspaces: ['client', 'server'],
			files: [],
			templateDir: undefined,
		} as any);
		await generateProject(opts);
		const pkg = JSON.parse(await fs.readFile(path.join(tmpDir, projectName, 'package.json'), 'utf8'));
		expect(pkg.scripts.test).toBe('pnpm run lint && pnpm run test');
		expect(pkg.scripts.build).toBe('pnpm -r run build');
		expect(pkg.workspaces).toBeUndefined(); // Deleted for pnpm
	});
});
