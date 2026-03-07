import {describe, it, expect, vi, beforeEach} from 'vitest';
import {generateProject} from './project.js';
import fse from 'fs-extra';
import {execa} from 'execa';
import path from 'node:path';
import os from 'node:os';
import * as p from '@clack/prompts';
import {getBaseTemplate} from '../templates/base/index.js';

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
		spinner: vi.fn(() => ({
			start: vi.fn(),
			stop: vi.fn(),
			message: vi.fn(),
		})),
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
		(vi.mocked(execa) as any).mockImplementation(async () => ({stdout: '', stderr: ''}));
		await fse.ensureDir(tmpDir);
	});

	it('should scaffold a cli project correctly', async () => {
		const projectName = 'test-cli-project';
		const opts = {
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
		expect(await fse.pathExists(projectPath)).toBe(true);
		const pkg = await fse.readJson(path.join(projectPath, 'package.json'));
		expect(pkg.name).toBe(projectName);
		expect(pkg.dependencies).toHaveProperty('commander');
		expect(execa).toHaveBeenCalledWith('git', ['init'], expect.anything());
		expect(execa).toHaveBeenCalledWith('gh', expect.anything(), expect.anything());
		expect(execa).toHaveBeenCalledWith('npm', ['install'], expect.anything());
		expect(execa).toHaveBeenCalledWith('npm', ['run', 'build'], expect.anything());
	});

	it('should handle git init failure', async () => {
		const projectName = 'test-git-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'git' && args?.[0] === 'init') {
				throw new Error('git fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts = {
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
		const opts = {
			template: 'webpage' as const,
			projectName,
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);
		expect(await fse.pathExists(projectPath)).toBe(true);
		expect(await fse.pathExists(path.join(projectPath, 'index.html'))).toBe(true);
	});

	it('should scaffold a webapp project correctly', async () => {
		const projectName = 'test-webapp-project';
		const opts = {
			template: 'webapp' as const,
			projectName,
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);
		expect(await fse.pathExists(projectPath)).toBe(true);
		expect(await fse.pathExists(path.join(projectPath, 'backend/src/index.ts'))).toBe(true);
	});

	it('should scaffold a fullstack project correctly', async () => {
		const projectName = 'test-fullstack-project';
		const opts = {
			template: 'fullstack' as const,
			projectName,
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);
		expect(await fse.pathExists(projectPath)).toBe(true);
		expect(await fse.pathExists(path.join(projectPath, 'client/tsdown.config.ts'))).toBe(true);
	});

	it('should handle --force flag', async () => {
		const projectName = 'test-force-project';
		const projectPath = path.join(tmpDir, projectName);
		await fse.ensureDir(projectPath);
		await fse.writeFile(path.join(projectPath, 'old-file.txt'), 'old');
		const opts = {
			template: 'cli' as const,
			projectName,
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
			force: true,
		};
		await generateProject(opts);
		expect(await fse.pathExists(path.join(projectPath, 'old-file.txt'))).toBe(false);
	});

	it('should handle --skip-build flag', async () => {
		const projectName = 'test-skip-build-project';
		const opts = {
			template: 'cli' as const,
			projectName,
			createGithubRepository: false,
			directory: tmpDir,
			update: false,
			skipBuild: true,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);
		const pkg = await fse.readJson(path.join(projectPath, 'package.json'));
		expect(pkg.scripts.build).toBeUndefined();
	});

	it('should handle --update flag', async () => {
		const projectName = 'test-update-project';
		const projectPath = path.join(tmpDir, projectName);
		await fse.ensureDir(projectPath);
		await fse.writeJson(path.join(projectPath, 'package.json'), {name: projectName, version: '1.0.0'});
		const opts = {
			template: 'cli' as const,
			projectName,
			createGithubRepository: false,
			directory: tmpDir,
			update: true,
		};
		await generateProject(opts);
		const pkg = await fse.readJson(path.join(projectPath, 'package.json'));
		expect(pkg.version).toBe('1.0.0');
	});

	it('should handle gh repo create failure', async () => {
		const projectName = 'test-github-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'gh' && args?.[0] === 'repo') throw new Error('GH failed');
			return {stdout: '', stderr: ''};
		});
		const opts = {
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
		await fse.ensureDir(projectPath);
		await fse.writeFile(path.join(projectPath, 'README.md'), 'old');
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'git' && args?.[0] === 'merge-file') {
				const err = new Error('conflict');
				(err as any).exitCode = 1;
				throw err;
			}
			return {stdout: '', stderr: ''};
		});
		const opts = {
			template: 'cli' as const,
			projectName,
			directory: tmpDir,
			update: true,
		};
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Conflict in'));
	});

	it('should handle other merge errors', async () => {
		const projectName = 'test-merge-error';
		const projectPath = path.join(tmpDir, projectName);
		await fse.ensureDir(projectPath);
		await fse.writeFile(path.join(projectPath, 'README.md'), 'old');
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'git' && args?.[0] === 'merge-file') throw new Error('fatal');
			return {stdout: '', stderr: ''};
		});
		const opts = {
			template: 'cli' as const,
			projectName,
			directory: tmpDir,
			update: true,
		};
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Failed to merge'));
	});

	it('should handle build failure', async () => {
		const projectName = 'test-build-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'npm' && args?.[1] === 'build') throw new Error('fail');
			return {stdout: '', stderr: ''};
		});
		const opts = {
			template: 'cli' as const,
			projectName,
			directory: tmpDir,
			update: false,
			build: true,
		};
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('fail'));
	});

	it('should skip git init if already exists', async () => {
		const projectName = 'test-git-exists';
		const projectPath = path.join(tmpDir, projectName);
		await fse.ensureDir(path.join(projectPath, '.git'));
		const opts = {
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
		const opts = {
			template: 'webpage' as const,
			projectName,
			directory: tmpDir,
			update: false,
			skipBuild: true,
		};
		await generateProject(opts);
		const projectPath = path.join(tmpDir, projectName);
		expect(await fse.pathExists(path.join(projectPath, 'src/index.js'))).toBe(true);
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
		});
		const opts = {template: 'cli' as const, projectName, directory: tmpDir, update: false};
		await generateProject(opts);
		expect(await fse.readFile(path.join(tmpDir, projectName, 'p.txt'), 'utf8')).toBe('hello');
	});

	it('should handle programmatic update merge', async () => {
		const projectName = 'test-prog-update';
		const projectPath = path.join(tmpDir, projectName);
		await fse.ensureDir(projectPath);
		await fse.writeFile(path.join(projectPath, 'p.txt'), 'old');
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'p.txt', content: 'new'}],
			templateDir: undefined,
		});
		const opts = {template: 'cli' as const, projectName, directory: tmpDir, update: true};
		await generateProject(opts);
		expect(execa).toHaveBeenCalledWith('git', ['merge-file', path.join(projectPath, 'p.txt'), expect.anything(), expect.anything()]);
	});

	it('should skip programmatic files if identical', async () => {
		const projectName = 'test-prog-ident';
		const projectPath = path.join(tmpDir, projectName);
		await fse.ensureDir(projectPath);
		await fse.writeFile(path.join(projectPath, 'p.txt'), 'same');
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'p.txt', content: 'same'}],
			templateDir: undefined,
		});
		const opts = {template: 'cli' as const, projectName, directory: tmpDir, update: true};
		await generateProject(opts);
		expect(execa).not.toHaveBeenCalledWith('git', ['merge-file', expect.anything(), expect.anything(), expect.anything()]);
	});

	it('should handle npm install failure', async () => {
		const projectName = 'test-inst-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string) => {
			if (cmd === 'npm') throw new Error('inst fail');
			return {stdout: '', stderr: ''};
		});
		const opts = {template: 'cli' as const, projectName, directory: tmpDir, update: false, installDependencies: true};
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('inst fail'));
	});

	it('should handle dev server failure', async () => {
		const projectName = 'test-dev-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'npm' && args?.[1] === 'dev') throw new Error('dev fail');
			return {stdout: '', stderr: ''};
		});
		const opts = {template: 'cli' as const, projectName, directory: tmpDir, update: false, dev: true};
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('dev fail'));
	});

	it('should throw if directory exists and no force/update/overwrite', async () => {
		const projectName = 'test-exists-error';
		const projectPath = path.join(tmpDir, projectName);
		await fse.ensureDir(projectPath);
		const opts = {template: 'cli' as const, projectName, directory: tmpDir, update: false};
		await expect(generateProject(opts)).rejects.toThrow('already exists');
	});

	it('should handle dev server failure with open', async () => {
		const projectName = 'test-dev-open-fail';
		(vi.mocked(execa) as any).mockImplementation(async (cmd: string, args: string[]) => {
			if (cmd === 'npm' && args?.[1] === 'dev') throw new Error('open fail');
			return {stdout: '', stderr: ''};
		});
		const opts = {template: 'cli' as const, projectName, directory: tmpDir, update: false, dev: true, open: true};
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('open fail'));
	});

	it('should skip programmatic seed files during update', async () => {
		const projectName = 'test-prog-seed';
		vi.mocked(getBaseTemplate).mockReturnValue({
			name: 'base',
			dependencies: {},
			devDependencies: {},
			scripts: {},
			files: [{path: 'src/index.ts', content: 'new'}],
			templateDir: undefined,
		});
		const opts = {template: 'cli' as const, projectName, directory: tmpDir, update: true};
		await generateProject(opts);
		expect(await fse.pathExists(path.join(tmpDir, projectName, 'src/index.ts'))).toBe(false);
	});
});
