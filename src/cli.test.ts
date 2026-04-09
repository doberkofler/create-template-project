import {describe, it, expect, vi, beforeEach, type MockInstance} from 'vitest';
import * as p from '@clack/prompts';
import debugLib from 'debug';
import {parseArgs} from './cli.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createCodedError} from './test/mocks.js';

vi.mock(import('execa'));

// eslint-disable-next-line vitest/prefer-import-in-mock
vi.mock('debug', async (importOriginal) => {
	const actual = await importOriginal<{
		default: ((namespace: string) => (...args: unknown[]) => void) & {
			enable: (namespaces: string) => void;
			disable: () => string;
		};
	}>();
	const debugFactory = vi.fn<(namespace: string) => (...args: unknown[]) => void>(() => vi.fn<(...args: unknown[]) => void>());

	return {
		...actual,
		default: Object.assign(debugFactory, {
			enable: vi.fn<(namespaces: string) => void>(),
			disable: vi.fn<() => string>(() => ''),
		}),
	};
});

vi.mock(import('@clack/prompts'), async (importOriginal) => {
	const {createPromptsMock} = await import('./test/mocks.js');
	return createPromptsMock(importOriginal as () => Promise<Record<string, unknown>>);
});

vi.mock(import('./generators/info.js'), async () => {
	const {createTemplateInfoMock} = await import('./test/mocks.js');
	return createTemplateInfoMock();
});

describe('cli', () => {
	const originalArgv = process.argv;
	let exitSpy: MockInstance<(code?: string | number | null) => never>;

	beforeEach(() => {
		vi.resetAllMocks();
		process.argv = originalArgv.slice(0, 2);
		delete process.env.DEBUG;
		debugLib.disable();

		exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
			const err = createCodedError(`Process exited with code ${code}`, code === 0 ? 'PROCESS_EXIT_0' : 'PROCESS_EXIT_1', Number(code));
			throw err;
		});
		vi.mocked(p.isCancel).mockReturnValue(false);
	});

	it('should handle info command', async () => {
		process.argv.push('info');
		await expect(parseArgs()).rejects.toThrow('Process exited with code 0');
		expect(p.intro).toHaveBeenCalled();
		expect(p.note).toHaveBeenCalled();
		expect(p.outro).toHaveBeenCalled();
	});

	it('should handle info command with specific template', async () => {
		process.argv.push('info', '-t', 'cli');
		await expect(parseArgs()).rejects.toThrow('Process exited with code 0');
		expect(p.note).toHaveBeenCalledWith(expect.any(String), 'Template: cli');
	});

	it('should exit if invalid template type used in info', async () => {
		process.argv.push('info', '-t', 'invalid');
		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('Invalid template type'));
	});

	it('should parse create command arguments', async () => {
		process.argv.push('create', '-t', 'cli', '-n', 'my-test-project', '--path', './test-dir', '-a', 'Test Author', '--github-username', 'test-user');
		const result = await parseArgs();
		expect(result).toMatchObject({
			template: 'cli',
			projectName: 'my-test-project',
			author: 'Test Author',
			githubUsername: 'test-user',
			directory: path.resolve('./test-dir'),
			packageManager: 'pnpm',
		});
	});

	it('should strip surrounding quotes from CLI arguments', async () => {
		process.argv.push(
			'create',
			'-t',
			'"cli"',
			'-n',
			'"quoted-project"',
			'--path',
			'./test-dir-quoted',
			'-a',
			"'Quoted Author'",
			'--github-username',
			'"quoted-user"',
		);
		const result = await parseArgs();
		expect(result.template).toBe('cli');
		expect(result.projectName).toBe('quoted-project');
		expect(result.author).toBe('Quoted Author');
		expect(result.githubUsername).toBe('quoted-user');
	});

	it('should handle nested and mismatched quotes', async () => {
		process.argv.push('create', '-t', '""cli""', '-n', '"\'mixed-quoted\'"', '--path', './test-dir-nested', '-a', 'NoQuotes', '--github-username', 'user');
		const result = await parseArgs();
		expect(result.template).toBe('cli');
		expect(result.projectName).toBe('mixed-quoted');
		expect(result.author).toBe('NoQuotes');
	});

	it('should parse update command arguments', async () => {
		const tempDir = path.resolve('./temp-update-test');
		await fs.mkdir(tempDir, {recursive: true});
		await fs.writeFile(
			path.join(tempDir, 'package.json'),
			JSON.stringify({
				name: 'temp-project',
				author: 'Old Author',
				'create-template-project': {
					template: 'web-vanilla',
					githubUsername: 'old-github-user',
				},
			}),
		);

		process.argv.push('update', '-t', 'web-vanilla', '-d', tempDir);
		const result = await parseArgs();
		expect(result.update).toBe(true);
		expect(result.projectName).toBe('temp-project');
		expect(result.author).toBe('Old Author');
		expect(result.githubUsername).toBe('old-github-user');
		expect(result.packageManager).toBe('pnpm');

		await fs.rm(tempDir, {recursive: true, force: true});
	});

	it('should handle interactive mode', async () => {
		process.argv.push('interactive');
		// Order: ProjectName (text), Directory (text), Description (text), Keywords (text), Author (text), GithubUsername (text), Template (select), PM (select), CI (confirm), GH (confirm)
		vi.mocked(p.text)
			.mockResolvedValueOnce('my-web-fullstack-app')
			.mockResolvedValueOnce('./out')
			.mockResolvedValueOnce('A cool fullstack app')
			.mockResolvedValueOnce('fullstack, react, express')
			.mockResolvedValueOnce('Test Author')
			.mockResolvedValueOnce('test-github-user');
		vi.mocked(p.select).mockResolvedValueOnce('web-fullstack').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(true);
		const result = await parseArgs();
		expect(result).toMatchObject({
			template: 'web-fullstack',
			projectName: 'my-web-fullstack-app',
			description: 'A cool fullstack app',
			keywords: 'fullstack, react, express',
			author: 'Test Author',
		});
	});

	it('should exit if no arguments provided', async () => {
		await expect(parseArgs()).rejects.toThrow('Process exited with code 0');
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it('should handle cancel at first prompt', async () => {
		process.argv.push('interactive');
		vi.mocked(p.text).mockResolvedValueOnce('cli');
		vi.mocked(p.isCancel).mockReturnValueOnce(true);
		await expect(parseArgs()).rejects.toThrow('Process exited with code 0');
		expect(p.cancel).toHaveBeenCalledWith('Operation cancelled.');
	});

	it('should handle directory exists prompt', async () => {
		process.argv.push('interactive');
		const projectName = 'exists-test';
		const projectDir = path.resolve('.', projectName);
		await fs.mkdir(projectDir, {recursive: true});
		await fs.writeFile(
			path.join(projectDir, 'package.json'),
			JSON.stringify({
				name: projectName,
				author: 'Test Author',
				'create-template-project': {template: 'cli'},
			}),
		);

		// Order: ProjectName (text), Directory (text), Description (text), Keywords (text), Author (text), GithubUsername (text), Action (select), Template (select), CI (confirm), GH (confirm)
		vi.mocked(p.text)
			.mockResolvedValueOnce(projectName)
			.mockResolvedValueOnce('.')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('Test Author')
			.mockResolvedValueOnce('test-github-user');
		vi.mocked(p.select).mockResolvedValueOnce('update').mockResolvedValueOnce('cli');
		vi.mocked(p.confirm).mockResolvedValue(false);

		const result = await parseArgs();
		expect(result.update).toBe(true);
		expect(result.author).toBe('Test Author');
		await fs.rm(projectDir, {recursive: true, force: true});
	});

	it('should handle web-app specifically in interactive', async () => {
		process.argv.push('interactive');
		vi.mocked(p.text)
			.mockResolvedValueOnce('web-app-test')
			.mockResolvedValueOnce('.')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('Test Author')
			.mockResolvedValueOnce('test-github-user');
		vi.mocked(p.select).mockResolvedValueOnce('web-app').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(false);
		const result = await parseArgs();
		expect(result.template).toBe('web-app');
		expect(result.author).toBe('Test Author');
	});

	it('should handle full interactive flow', async () => {
		process.argv.push('interactive');
		// Order: ProjectName (text), Directory (text), Description (text), Keywords (text), Author (text), GithubUsername (text), Template (select), PM (select), CI (confirm), GH (confirm)
		vi.mocked(p.text)
			.mockResolvedValueOnce('full-test')
			.mockResolvedValueOnce('.')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('Test Author')
			.mockResolvedValueOnce('test-github-user');
		vi.mocked(p.select).mockResolvedValueOnce('cli').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(true);
		const result = await parseArgs();
		expect(result.build).toBe(true);
		expect(result.author).toBe('Test Author');
	});

	it('should exit if mandatory options missing in create', async () => {
		process.argv.push('create', '-n', 'no-template');
		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		expect(p.cancel).toHaveBeenCalledWith(expect.stringContaining("error: required option '--path <path>' not specified"));
	});

	it('should use existing template from package.json during interactive update', async () => {
		process.argv.push('interactive');
		const projectName = 'smart-update-test';
		const projectDir = path.resolve('.', projectName);
		await fs.mkdir(projectDir, {recursive: true});
		await fs.writeFile(
			path.join(projectDir, 'package.json'),
			JSON.stringify({
				name: projectName,
				author: 'Test Author',
				'create-template-project': {template: 'web-fullstack'},
			}),
		);

		vi.mocked(p.text)
			.mockResolvedValueOnce(projectName)
			.mockResolvedValueOnce('.')
			.mockResolvedValueOnce('Test Description')
			.mockResolvedValueOnce('test, keywords')
			.mockResolvedValueOnce('Test Author')
			.mockResolvedValueOnce('test-github-user');
		vi.mocked(p.select).mockResolvedValueOnce('update');
		// Should NOT prompt for template because it's found in package.json
		vi.mocked(p.confirm).mockResolvedValue(true);

		const result = await parseArgs();
		expect(result.template).toBe('web-fullstack');
		expect(result.author).toBe('Test Author');
		expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Using existing template type: web-fullstack'));

		await fs.rm(projectDir, {recursive: true, force: true});
	});

	it('should exit if directory exists in create', async () => {
		const projectName = 'exists-non-interactive';
		const projectDir = path.resolve('.', projectName);
		await fs.mkdir(projectDir, {recursive: true});
		process.argv.push('create', '-t', 'cli', '-n', projectName, '--path', '.', '-a', 'Test Author');
		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		await fs.rm(projectDir, {recursive: true, force: true});
	});

	it.each([0, 1, 2, 3, 4, 5, 6, 7, 8])('should handle cancel at prompt stage %i', async (stage) => {
		vi.resetAllMocks();
		process.argv = [...originalArgv.slice(0, 2), 'interactive'];
		const exitSpyLocal = vi.spyOn(process, 'exit').mockImplementation((code) => {
			const err = createCodedError(`Process exited with code ${code}`, code === 0 ? 'PROCESS_EXIT_0' : 'PROCESS_EXIT_1');
			throw err;
		});

		let currentCall = 0;
		vi.mocked(p.isCancel).mockImplementation(() => currentCall++ === stage);

		vi.mocked(p.text)
			.mockResolvedValueOnce('test')
			.mockResolvedValueOnce('.')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('author');
		vi.mocked(p.select).mockResolvedValueOnce('update').mockResolvedValueOnce('cli').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(true);

		const projectDir = path.resolve('.', 'test');
		await fs.mkdir(projectDir, {recursive: true});
		await fs.writeFile(
			path.join(projectDir, 'package.json'),
			JSON.stringify({
				name: 'test',
				author: 'author',
				'create-template-project': {template: 'cli'},
			}),
		);

		await expect(parseArgs()).rejects.toThrow('Process exited with code');
		expect(p.cancel).toHaveBeenCalledWith('Operation cancelled.');

		await fs.rm(projectDir, {recursive: true, force: true});
		exitSpyLocal.mockRestore();
	});

	it('should handle update command with specific options', async () => {
		const tempDir = path.resolve('./temp-update-opts-test');
		await fs.mkdir(tempDir, {recursive: true});
		await fs.writeFile(
			path.join(tempDir, 'package.json'),
			JSON.stringify({
				name: 'upd-test',
				author: 'Test Author',
				'create-template-project': {template: 'web-app', githubUsername: 'test-github-user'},
			}),
		);

		process.argv.push('update', '-t', 'web-app', '-d', tempDir, '--no-progress');
		const result = await parseArgs();
		expect(result.update).toBe(true);
		expect(result.template).toBe('web-app');
		// eslint-disable-next-line vitest/prefer-strict-boolean-matchers, vitest/prefer-to-be-falsy
		expect(result.progress).toBe(false);
		expect(result.projectName).toBe('upd-test');
		expect(result.author).toBe('Test Author');
		expect(result.directory).toBe(tempDir);

		await fs.rm(tempDir, {recursive: true, force: true});
	});

	it('should exit if update run in directory with package.json missing name', async () => {
		const tempDir = path.resolve('./temp-no-name');
		await fs.mkdir(tempDir, {recursive: true});
		await fs.writeFile(
			path.join(tempDir, 'package.json'),
			JSON.stringify({
				version: '1.0.0',
				author: 'Test Author',
				'create-template-project': {template: 'cli'},
			}),
		);

		process.argv.push('update', '-t', 'cli', '-d', tempDir);
		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('No name property found'));

		await fs.rm(tempDir, {recursive: true, force: true});
	});

	it('should exit if update run in directory with package.json missing configuration', async () => {
		const tempDir = path.resolve('./temp-no-config');
		await fs.mkdir(tempDir, {recursive: true});
		await fs.writeFile(
			path.join(tempDir, 'package.json'),
			JSON.stringify({
				name: 'no-config',
				version: '1.0.0',
				author: 'Test Author',
			}),
		);

		process.argv.push('update', '-t', 'cli', '-d', tempDir);
		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('No "create-template-project" configuration found'));

		await fs.rm(tempDir, {recursive: true, force: true});
	});

	it('should exit if interactive update selected for project without configuration', async () => {
		process.argv.push('interactive');
		const projectName = 'inter-no-config';
		const projectDir = path.resolve('.', projectName);
		await fs.mkdir(projectDir, {recursive: true});
		await fs.writeFile(
			path.join(projectDir, 'package.json'),
			JSON.stringify({
				name: projectName,
				author: 'Test Author',
			}),
		);

		vi.mocked(p.text)
			.mockResolvedValueOnce(projectName)
			.mockResolvedValueOnce('.')
			.mockResolvedValueOnce('Test Description')
			.mockResolvedValueOnce('test, keywords')
			.mockResolvedValueOnce('Test Author')
			.mockResolvedValueOnce('test-github-user');
		vi.mocked(p.select).mockResolvedValueOnce('update');

		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('No "create-template-project" configuration found'));

		await fs.rm(projectDir, {recursive: true, force: true});
	});

	it('should validate project name in interactive mode', async () => {
		process.argv.push('interactive');
		let capturedValidate: ((value: string) => string | undefined) | undefined;
		vi.mocked(p.text).mockImplementation(async (opts) => {
			await Promise.resolve();
			if (opts.message === 'Project name:') {
				const {validate} = opts;

				if (typeof validate !== 'function') {
					return 'mock-response';
				}

				capturedValidate = (value: string): string | undefined => {
					const validationResult = validate(value);
					return typeof validationResult === 'string' ? validationResult : undefined;
				};
				return 'valid-name';
			}

			return 'mock-response';
		});
		vi.mocked(p.select)
			.mockResolvedValueOnce('cli') // Select project template
			.mockResolvedValueOnce('npm'); // Select package manager
		vi.mocked(p.confirm).mockResolvedValue(true);
		vi.mocked(p.isCancel).mockReturnValue(false);

		const result = await parseArgs();

		expect(capturedValidate).toBeDefined();
		if (capturedValidate === undefined) {
			throw new Error('Expected project name validate callback to be captured');
		}
		expect(capturedValidate('')).toBe('Project name is required');
		expect(result.projectName).toBe('valid-name');
		expect(result.author).toBe('mock-response');
		expect(result.packageManager).toBe('npm');
	});

	it('should handle --debug option', async () => {
		process.argv.push(
			'create',
			'-t',
			'cli',
			'-n',
			'debug-test',
			'--path',
			'./debug-test-dir',
			'-a',
			'Test Author',
			'--github-username',
			'test-github-user',
			'--debug',
		);
		await parseArgs();
		expect(process.env.DEBUG).toContain('create-template-project:*');
		expect(debugLib.enable).toHaveBeenCalledWith('create-template-project:*');
	});

	it('should fail interactive update if package.json is invalid', async () => {
		process.argv.push('interactive');
		const projectName = 'pkg-error-test';
		const projectDir = path.resolve('.', projectName);
		await fs.mkdir(projectDir, {recursive: true});
		await fs.writeFile(path.join(projectDir, 'package.json'), 'invalid json');

		vi.mocked(p.text)
			.mockResolvedValueOnce(projectName)
			.mockResolvedValueOnce('.')
			.mockResolvedValueOnce('Test Description')
			.mockResolvedValueOnce('test, keywords')
			.mockResolvedValueOnce('Test Author');
		vi.mocked(p.select).mockResolvedValueOnce('update');

		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('No "create-template-project" configuration found'));

		await fs.rm(projectDir, {recursive: true, force: true});
	});

	it('should exit if directory exists in create', async () => {
		const projectName = 'exists-non-interactive';
		const projectDir = path.resolve('.', projectName);
		await fs.mkdir(projectDir, {recursive: true});
		process.argv.push('create', '-t', 'cli', '-n', projectName, '--path', '.', '-a', 'Test Author');
		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		await fs.rm(projectDir, {recursive: true, force: true});
	});
});
