import {describe, it, expect, vi, beforeEach} from 'vitest';
import {generateProject} from './project.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execa} from 'execa';
import * as p from '@clack/prompts';
import {z} from 'zod';
import {getBaseTemplate} from '#templates/base/index.js';
import {isSeedFile} from '#shared/file.js';
import {type ProjectOptions, type TemplateDefinition} from '#shared/types.js';

const pathExists = async (filePath: string): Promise<boolean> => {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
};

const createProjectOptions = (overrides: Partial<ProjectOptions> & Pick<ProjectOptions, 'template' | 'projectName' | 'directory'>): ProjectOptions => ({
	author: 'Test Author',
	githubUsername: 'test-user',
	packageManager: 'npm',
	createGithubRepository: false,
	update: false,
	build: false,
	progress: true,
	...overrides,
});

const createExitCodeError = (message: string, exitCode: number): Error & {exitCode: number} => Object.assign(new Error(message), {exitCode});

const templateDefinitionFactory = (overrides: Partial<TemplateDefinition>): TemplateDefinition => ({
	name: 'base',
	description: 'base template',
	components: [],
	dependencies: {},
	devDependencies: {},
	files: [],
	scripts: {},
	...overrides,
});

const packageJsonSchema = z
	.object({
		name: z.string().optional(),
		author: z.string().optional(),
		bin: z.string().optional(),
		version: z.string().optional(),
		scripts: z.record(z.string(), z.string()).default({}),
		dependencies: z.record(z.string(), z.unknown()).default({}),
		workspaces: z.array(z.string()).optional(),
	})
	.loose();

const readPackageJson = async (projectPath: string): Promise<z.infer<typeof packageJsonSchema>> => {
	const raw = await fs.readFile(path.join(projectPath, 'package.json'), 'utf8');
	const parsed = JSON.parse(raw) as unknown;
	return packageJsonSchema.parse(parsed);
};

const setExecaMock = (implementation: (cmd: string, args?: string[]) => {stdout: string; stderr: string} | Promise<{stdout: string; stderr: string}>): void => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
	vi.mocked(execa).mockImplementation(implementation as unknown as typeof execa);
};

const spinnerMock: ReturnType<typeof p.spinner> = {
	start: vi.fn<(message?: string) => void>(),
	stop: vi.fn<(message?: string, code?: number) => void>(),
	message: vi.fn<(message: string) => void>(),
	cancel: vi.fn<(message?: string) => void>(),
	error: vi.fn<(message?: string) => void>(),
	clear: vi.fn<() => void>(),
	isCancelled: false,
};

vi.mock(import('execa'));
vi.mock(import('@clack/prompts'), async (importOriginal) => {
	const {createPromptsMock} = await import('./test-mocks.js');
	return createPromptsMock(importOriginal as () => Promise<Record<string, unknown>>);
});

vi.mock(import('#templates/base/index.js'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		getBaseTemplate: vi.fn<(opts: ProjectOptions) => TemplateDefinition>(actual.getBaseTemplate as (opts: ProjectOptions) => TemplateDefinition),
	};
});

describe('generateProject', () => {
	const tmpDir = path.join(os.tmpdir(), `create-template-project-test-${Math.random().toString(36).slice(2)}`);

	beforeEach(async () => {
		vi.clearAllMocks();
		const actual = await vi.importActual<{getBaseTemplate: (opts: ProjectOptions) => TemplateDefinition}>('#templates/base/index.js');
		vi.mocked(getBaseTemplate).mockImplementation(actual.getBaseTemplate);
		vi.mocked(p.spinner).mockReturnValue(spinnerMock);
		setExecaMock(() => ({stdout: '', stderr: ''}));
		await fs.mkdir(tmpDir, {recursive: true});
	});

	it('should scaffold a cli project correctly', async () => {
		const projectName = 'test-cli-project';
		const projectPath = path.join(tmpDir, projectName);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			author: 'Test Author',
			createGithubRepository: true,
			directory: projectPath,
			update: false,
			build: true,
		});
		await generateProject(opts);
		expect(await pathExists(projectPath)).toBe(true);
		const pkg = await readPackageJson(projectPath);
		expect(pkg.name).toBe(projectName);
		expect(pkg.author).toBe('Test Author');
		expect(pkg.bin).toBe('./dist/index.js');
		expect(pkg.dependencies).toHaveProperty('commander');
		expect(pkg.scripts['create-changelog']).toBe('conventional-changelog -p angular -i CHANGELOG.md -s -r 0');

		// Verify index.ts has hashbang
		const indexContent = await fs.readFile(path.join(projectPath, 'src/index.ts'), 'utf8');
		expect(indexContent).toContain('#!/usr/bin/env node');

		// Verify oxc.config.ts exists
		expect(await pathExists(path.join(projectPath, 'oxc.config.ts'))).toBe(true);
		const cliOxcConfig = await fs.readFile(path.join(projectPath, 'oxc.config.ts'), 'utf8');
		expect(cliOxcConfig).toContain('node: true');

		// Verify README.md contains project name
		const readme = await fs.readFile(path.join(projectPath, 'README.md'), 'utf8');
		expect(readme).toContain(projectName);

		// Verify LICENSE exists and contains author/year
		expect(await pathExists(path.join(projectPath, 'LICENSE'))).toBe(true);
		const license = await fs.readFile(path.join(projectPath, 'LICENSE'), 'utf8');
		expect(license).toContain('Test Author');
		expect(license).toContain(new Date().getFullYear().toString());

		// Verify Husky hooks exist and are executable (simulated by checking if chmod was called or just if file exists in test)
		expect(await pathExists(path.join(projectPath, '.husky/pre-commit'))).toBe(true);
		expect(await pathExists(path.join(projectPath, '.husky/commit-msg'))).toBe(true);

		const preCommit = await fs.readFile(path.join(projectPath, '.husky/pre-commit'), 'utf8');
		expect(preCommit).toContain('npm run ci');

		expect(execa).toHaveBeenCalledWith('git', ['init', '--initial-branch=main'], expect.anything());
		expect(execa).toHaveBeenCalledWith('git', ['add', '.'], expect.anything());
		expect(execa).toHaveBeenCalledWith('git', ['commit', '-m', 'chore: initial scaffold'], expect.anything());
		expect(execa).toHaveBeenCalledWith('gh', ['repo', 'create', projectName, '--public', '--source=.', '--remote=origin', '--push'], expect.anything());
		expect(execa).toHaveBeenCalledWith('npm', ['install'], expect.anything());
		expect(execa).toHaveBeenCalledWith('npm', ['run', 'ci'], expect.anything());
	});

	it('should handle git init failure', async () => {
		const projectName = 'test-git-fail';
		const projectPath = path.join(tmpDir, projectName);
		setExecaMock((cmd: string, args: string[] = []) => {
			if (cmd === 'git' && args[0] === 'init') {
				throw new Error('git fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
		});
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('git fail'));
	});

	it('should scaffold a web-vanilla project correctly', async () => {
		const projectName = 'test-web-vanilla-project';
		const projectPath = path.join(tmpDir, projectName);
		const opts = createProjectOptions({
			template: 'web-vanilla',
			projectName,
			createGithubRepository: false,
			directory: projectPath,
			update: false,
		});
		await generateProject(opts);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'index.html'))).toBe(true);
	});

	it('should scaffold a web-app project correctly', async () => {
		const projectName = 'test-web-app-project';
		const projectPath = path.join(tmpDir, projectName);
		const opts = createProjectOptions({
			template: 'web-app',
			projectName,
			createGithubRepository: false,
			directory: projectPath,
			update: false,
		});
		await generateProject(opts);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'src/index.tsx'))).toBe(true);
		const webAppOxcConfig = await fs.readFile(path.join(projectPath, 'oxc.config.ts'), 'utf8');
		expect(webAppOxcConfig).not.toContain('node: true');
	});

	it('should scaffold a web-fullstack project correctly', async () => {
		const projectName = 'test-web-fullstack-project';
		const projectPath = path.join(tmpDir, projectName);
		const opts = createProjectOptions({
			template: 'web-fullstack',
			projectName,
			createGithubRepository: false,
			directory: projectPath,
			update: false,
		});
		await generateProject(opts);
		expect(await pathExists(projectPath)).toBe(true);
		expect(await pathExists(path.join(projectPath, 'client/vite.config.ts'))).toBe(true);

		// Verify package.json content
		const pkg = await readPackageJson(projectPath);
		expect(pkg.dependencies).toHaveProperty('@mui/icons-material');
		expect(pkg.dependencies).toHaveProperty('@trpc/react-query');
		expect(pkg.dependencies).not.toHaveProperty('@trpc/tanstack-react-query');
		expect(pkg.workspaces).toContain('client');
		expect(pkg.workspaces).toContain('server');
		expect(pkg.scripts['create-changelog']).toBe('conventional-changelog -p angular -i CHANGELOG.md -s -r 0');

		const fullstackOxcConfig = await fs.readFile(path.join(projectPath, 'oxc.config.ts'), 'utf8');
		expect(fullstackOxcConfig).toContain('node: true');

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
		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
				name: 'base',
				dependencies: {'missing-dep': ''},
				devDependencies: {},
				scripts: {},
				files: [],
				templateDir: undefined,
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
		});
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Dependency "missing-dep" not found'));
		const pkg = await readPackageJson(projectPath);
		expect(pkg.dependencies).toHaveProperty('missing-dep', '');
	});

	it('should handle pnpm workspaces correctly', async () => {
		const projectName = 'test-pnpm-workspaces';
		const projectPath = path.join(tmpDir, projectName);
		const opts = createProjectOptions({
			template: 'web-fullstack',
			projectName,
			packageManager: 'pnpm',
			directory: projectPath,
			update: false,
		});
		await generateProject(opts);

		// Verify package.json does NOT have workspaces
		const pkg = await readPackageJson(projectPath);
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

	it('should handle --update flag', async () => {
		const projectName = 'test-update-project';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				version: '1.0.0',
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			createGithubRepository: false,
			directory: projectPath,
			update: true,
		});
		await generateProject(opts);
		const pkg = await readPackageJson(projectPath);
		expect(pkg.version).toBe('1.0.0');
	});

	it('should handle gh repo create failure', async () => {
		const projectName = 'test-github-fail';
		const projectPath = path.join(tmpDir, projectName);
		setExecaMock((cmd: string, args: string[] = []) => {
			if (cmd === 'gh' && args[0] === 'repo') {
				throw new Error('GH failed');
			}
			return {stdout: '', stderr: ''};
		});
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			createGithubRepository: true,
			directory: projectPath,
			update: false,
		});
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to create/push GitHub repository'));
	});

	it('should handle merge conflicts', async () => {
		const projectName = 'test-merge-conflict';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'tsconfig.json'), 'old');
		setExecaMock((cmd: string, args: string[] = []) => {
			if (cmd === 'git' && args[0] === 'merge-file') {
				throw createExitCodeError('conflict', 1);
			}
			return {stdout: '', stderr: ''};
		});
		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
		});
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Conflict: tsconfig.json'));
	});

	it('should handle other merge errors', async () => {
		const projectName = 'test-merge-error';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'tsconfig.json'), 'old');
		setExecaMock((cmd: string, args: string[] = []) => {
			if (cmd === 'git' && args[0] === 'merge-file') {
				throw new Error('fatal');
			}
			return {stdout: '', stderr: ''};
		});
		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
		});
		await generateProject(opts);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Failed to merge'));
	});

	it('should handle ci script failure', async () => {
		const projectName = 'test-ci-fail';
		const projectPath = path.join(tmpDir, projectName);
		setExecaMock((cmd: string, args: string[] = []) => {
			if (cmd === 'npm' && args[1] === 'ci') {
				throw new Error('fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
			build: true,
		});
		await expect(generateProject(opts)).rejects.toThrow(/Failed to run CI script:?/);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('fail'));
	});

	it('should skip git init if already exists', async () => {
		const projectName = 'test-git-exists';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(path.join(projectPath, '.git'), {recursive: true});
		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
		});
		await generateProject(opts);
		expect(execa).not.toHaveBeenCalledWith('git', ['init', '--initial-branch=main'], expect.anything());
	});

	it('should handle programmatic files', async () => {
		const projectName = 'test-prog';
		const projectPath = path.join(tmpDir, projectName);
		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
				name: 'base',
				dependencies: {},
				devDependencies: {},
				scripts: {},
				files: [{path: 'p.txt', content: 'hello'}],
				templateDir: undefined,
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
		});
		await generateProject(opts);
		expect(await fs.readFile(path.join(projectPath, 'p.txt'), 'utf8')).toBe('hello');
	});

	it('should handle programmatic update merge', async () => {
		const projectName = 'test-prog-update';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'p.txt'), 'old');
		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
				name: 'base',
				dependencies: {},
				devDependencies: {},
				scripts: {},
				files: [{path: 'p.txt', content: 'new'}],
				templateDir: undefined,
			}),
		);
		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
		});
		await generateProject(opts);
		expect(execa).toHaveBeenCalledWith('git', ['merge-file', path.join(projectPath, 'p.txt'), expect.anything(), expect.anything()], expect.anything());
	});

	it('should skip programmatic files if identical', async () => {
		const projectName = 'test-prog-ident';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'p.txt'), 'same');
		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
				name: 'base',
				dependencies: {},
				devDependencies: {},
				scripts: {},
				files: [{path: 'p.txt', content: 'same'}],
				templateDir: undefined,
			}),
		);
		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
		});
		await generateProject(opts);
		expect(execa).not.toHaveBeenCalledWith('git', ['merge-file', expect.anything(), expect.anything(), expect.anything()]);
	});

	it('should handle npm install failure', async () => {
		const projectName = 'test-inst-fail';
		const projectPath = path.join(tmpDir, projectName);
		setExecaMock((cmd: string) => {
			if (cmd === 'npm') {
				throw new Error('inst fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
			build: true,
		});
		await expect(generateProject(opts)).rejects.toThrow(/Failed to install dependencies:?/);
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('inst fail'));
	});

	it('should handle format failure', async () => {
		const projectName = 'test-format-fail';
		const projectPath = path.join(tmpDir, projectName);
		setExecaMock((cmd: string, args: string[] = []) => {
			if (cmd === 'npm' && args[1] === 'format') {
				throw new Error('format fail');
			}
			return {stdout: '', stderr: ''};
		});
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
			build: true,
		});
		// We need to make sure format script exists in the package
		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
				name: 'base',
				dependencies: {},
				devDependencies: {},
				scripts: {
					format: 'oxfmt --write .',
					ci: 'npm run lint && npm run test',
				},
				files: [],
				templateDir: undefined,
			}),
		);

		await generateProject(opts);
		// Should NOT throw but log error
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(spinnerMock.stop).toHaveBeenCalledWith('Failed to format files.');
	});

	it('should handle programmatic update conflict', async () => {
		const projectName = 'test-prog-conflict';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'p.txt'), 'old');
		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
				name: 'base',
				dependencies: {},
				devDependencies: {},
				scripts: {},
				files: [{path: 'p.txt', content: 'new'}],
				templateDir: undefined,
			}),
		);
		setExecaMock((cmd: string, args: string[] = []) => {
			if (cmd === 'git' && args[0] === 'merge-file') {
				throw createExitCodeError('conflict', 1);
			}
			return {stdout: '', stderr: ''};
		});
		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
		});
		await generateProject(opts);
		expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Conflict: p.txt'));
	});

	it('should handle programmatic update returning updated', async () => {
		const projectName = 'test-prog-updated';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'p.txt'), 'old');
		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
				name: 'base',
				dependencies: {},
				devDependencies: {},
				scripts: {},
				files: [{path: 'p.txt', content: 'new'}],
				templateDir: undefined,
			}),
		);
		// Mock file write after git merge-file to match template
		setExecaMock(async (cmd: string, args: string[] = []) => {
			if (cmd === 'git' && args[0] === 'merge-file') {
				await fs.writeFile(args[1], 'new');
				return {stdout: '', stderr: ''};
			}
			return {stdout: '', stderr: ''};
		});
		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
		});
		await generateProject(opts);
		expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Updated: p.txt'));
	});

	it('should throw if directory exists and no update', async () => {
		const projectName = 'test-exists-error';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
		});
		await expect(generateProject(opts)).rejects.toThrow('already exists');
	});

	it('should transform npm scripts to yarn correctly', async () => {
		const projectName = 'test-yarn-scripts';
		const projectPath = path.join(tmpDir, projectName);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			packageManager: 'yarn',
			directory: projectPath,
			update: false,
		});
		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
				name: 'base',
				dependencies: {},
				devDependencies: {},
				scripts: {
					test: 'npm run lint && npm run test',
				},
				files: [],
				templateDir: undefined,
			}),
		);
		await generateProject(opts);
		const pkg = await readPackageJson(projectPath);
		expect(pkg.scripts.test).toBe('yarn run lint && yarn run test');
	});

	it('should create GENERATED.md and show success message', async () => {
		const projectName = 'test-summary';
		const projectPath = path.join(tmpDir, projectName);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
		});
		await generateProject(opts);
		expect(p.log.success).toHaveBeenCalledWith(
			expect.stringContaining(`Project "${projectName}" scaffolded successfully in ${projectPath}. A detailed setup guide has been generated at GENERATED.md`),
		);
		const generatedMd = await fs.readFile(path.join(projectPath, 'GENERATED.md'), 'utf8');
		expect(generatedMd).toContain(`# 🚀 Project Setup Guide: ${projectName}`);
		expect(generatedMd).toContain('## 📋 Initialization Checklist');
		expect(generatedMd).toContain('## ⏭️ Complete Skipped Steps Manually');
		expect(generatedMd).toContain(`gh repo create ${projectName} --public --source=. --remote=origin --push`);
	});

	it('should create GENERATED.md even when progress is false', async () => {
		const projectName = 'test-no-summary-no-progress';
		const projectPath = path.join(tmpDir, projectName);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
			progress: false,
		});
		await generateProject(opts);
		expect(await pathExists(path.join(projectPath, 'GENERATED.md'))).toBe(true);
	});

	it('should not show progress when progress is false', async () => {
		const projectName = 'test-no-progress';
		const projectPath = path.join(tmpDir, projectName);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: false,
			progress: false,
		});
		await generateProject(opts);
		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(spinnerMock.start).not.toHaveBeenCalled();
		expect(p.note).not.toHaveBeenCalled();
	});

	it('should transform npm scripts to pnpm correctly', async () => {
		const projectName = 'test-pnpm-scripts';
		const projectPath = path.join(tmpDir, projectName);
		const opts = createProjectOptions({
			template: 'web-fullstack',
			projectName,
			packageManager: 'pnpm',
			directory: projectPath,
			update: false,
		});
		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
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
			}),
		);
		await generateProject(opts);
		const pkg = await readPackageJson(projectPath);
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

		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
			progress: false,
		});

		await generateProject(opts);
		expect(await pathExists(path.join(projectPath, 'vitest.config.ts'))).not.toBe(true);
	});

	it('should handle deleting programmatic files during update if no longer required', async () => {
		const projectName = 'delete-prog-update-test';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		// vitest.config.ts is NOT required for cli
		await fs.writeFile(path.join(projectPath, 'vitest.config.ts'), 'content');

		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
				name: 'base',
				dependencies: {},
				devDependencies: {},
				scripts: {},
				files: [{path: 'vitest.config.ts', content: 'test'}],
				templateDir: undefined,
			}),
		);

		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
			progress: false,
		});

		await generateProject(opts);
		expect(await pathExists(path.join(projectPath, 'vitest.config.ts'))).not.toBe(true);
	});

	it('should handle skipping seed files and markdown files during update', async () => {
		const projectName = 'skip-seed-test';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.mkdir(path.join(projectPath, 'src'), {recursive: true});
		await fs.writeFile(path.join(projectPath, 'src/main.ts'), 'my code');
		await fs.writeFile(path.join(projectPath, 'README.md'), 'my readme');

		vi.mocked(getBaseTemplate).mockReturnValue(
			templateDefinitionFactory({
				name: 'base',
				dependencies: {},
				devDependencies: {},
				scripts: {},
				files: [
					{path: 'src/main.ts', content: 'template code'},
					{path: 'README.md', content: 'template readme'},
				],
				templateDir: undefined,
			}),
		);

		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'cli'},
			}),
		);
		const opts = createProjectOptions({
			template: 'cli',
			projectName,
			directory: projectPath,
			update: true,
			progress: false,
		});

		await generateProject(opts);
		const content = await fs.readFile(path.join(projectPath, 'src/main.ts'), 'utf8');
		expect(content).toBe('my code');

		const readme = await fs.readFile(path.join(projectPath, 'README.md'), 'utf8');
		expect(readme).toBe('my readme');
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
		expect(isSeedFile('README.md')).toBe(true);
		expect(isSeedFile('package.json')).not.toBe(true);
		expect(isSeedFile('src.ts')).not.toBe(true);
	});

	it('should handle updating pnpm-workspace.yaml when content changes', async () => {
		const projectName = 'pnpm-ws-update-test';
		const projectPath = path.join(tmpDir, projectName);
		await fs.mkdir(projectPath, {recursive: true});
		await fs.writeFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'old content');

		await fs.writeFile(
			path.join(projectPath, 'package.json'),
			JSON.stringify({
				name: projectName,
				'create-template-project': {template: 'web-fullstack'},
			}),
		);
		const opts = createProjectOptions({
			template: 'web-fullstack',
			projectName,
			packageManager: 'pnpm',
			directory: projectPath,
			update: true,
			progress: false,
		});

		await generateProject(opts);
		const content = await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8');
		expect(content).toContain('packages:');
		expect(content).not.toBe('old content');
	});

	it('should include "lcov" reporter in all vitest/vite coverage configurations', async () => {
		const templates = ['cli', 'web-vanilla', 'web-app', 'web-fullstack'] as const;

		await Promise.all(
			templates.map(async (template) => {
				const projectName = `test-lcov-${template}`;
				const projectPath = path.join(tmpDir, projectName);
				const opts = createProjectOptions({
					template,
					projectName,
					directory: projectPath,
					update: false,
					progress: false,
				});
				await generateProject(opts);

				const configFiles = [
					path.join(projectPath, 'vite.config.ts'),
					path.join(projectPath, 'vitest.config.ts'),
					path.join(projectPath, 'client/vite.config.ts'),
					path.join(projectPath, 'server/vite.config.ts'),
				];

				await Promise.all(
					configFiles.map(async (configFile) => {
						if (!(await pathExists(configFile))) {
							return;
						}

						const content = await fs.readFile(configFile, 'utf8');
						if (!content.includes('coverage:')) {
							return;
						}

						// Ensure "lcov" is present if "coverage" is configured
						expect(content).toContain("'lcov'");
					}),
				);
			}),
		);

		// Also check the root vite.config.ts of THIS project
		const rootConfig = path.resolve(__dirname, '../../vite.config.ts');
		const rootContent = await fs.readFile(rootConfig, 'utf8');
		expect(rootContent).toContain("'lcov'");
	});
});
