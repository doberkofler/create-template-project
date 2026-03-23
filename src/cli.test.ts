import {describe, it, expect, vi, beforeEach, type MockInstance} from 'vitest';
import * as p from '@clack/prompts';
import debugLib from 'debug';

vi.mock('debug', () => {
	const debugMock = vi.fn(() => vi.fn());
	return {
		default: Object.assign(debugMock, {
			enable: vi.fn(),
			disable: vi.fn(),
		}),
	};
});

import {parseArgs} from './cli.js';
import path from 'node:path';
import fs from 'node:fs/promises';

vi.mock('@clack/prompts', async (importOriginal) => {
	const actual = (await importOriginal()) as any;
	return {
		...actual,
		intro: vi.fn(),
		outro: vi.fn(),
		select: vi.fn(),
		text: vi.fn(),
		confirm: vi.fn(),
		isCancel: vi.fn(() => false),
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

vi.mock('./generators/info.js', () => ({
	getAllTemplatesInfo: vi.fn(() => [
		{
			name: 'cli',
			description: 'desc',
			components: [{name: 'c1', description: 'd1'}],
		},
	]),
	getTemplateInfo: vi.fn(() => ({
		name: 'cli',
		description: 'desc',
		components: [{name: 'c1', description: 'd1'}],
	})),
}));

describe('cli', () => {
	const originalArgv = process.argv;
	let exitSpy: MockInstance<any>;

	beforeEach(() => {
		vi.resetAllMocks();
		process.argv = originalArgv.slice(0, 2);
		delete process.env['DEBUG'];
		debugLib.disable();

		exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
			const err: any = new Error(`Process exited with code ${code}`);
			err.code = code === 0 ? 'PROCESS_EXIT_0' : 'PROCESS_EXIT_1';
			err.exitCode = code;
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
		process.argv.push('create', '-t', 'cli', '-n', 'my-test-project', '--path', './test-dir', '-a', 'Test Author');
		const result = await parseArgs();
		expect(result).toMatchObject({
			template: 'cli',
			projectName: 'my-test-project',
			author: 'Test Author',
			directory: path.resolve('./test-dir'),
			packageManager: 'pnpm',
		});
	});

	it('should parse update command arguments', async () => {
		const tempDir = path.resolve('./temp-update-test');
		await fs.mkdir(tempDir, {recursive: true});
		await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({name: 'temp-project', author: 'Old Author'}));

		process.argv.push('update', '-t', 'web-vanilla', '-d', tempDir);
		const result = await parseArgs();
		expect(result.update).toBe(true);
		expect(result.projectName).toBe('temp-project');
		expect(result.author).toBe('Old Author');
		expect(result.packageManager).toBe('pnpm');

		await fs.rm(tempDir, {recursive: true, force: true});
	});

	it('should handle interactive mode', async () => {
		process.argv.push('interactive');
		// Order: ProjectName (text), Directory (text), Description (text), Keywords (text), Author (text), Template (select), PM (select), Deps (confirm), CI (confirm), GH (confirm)
		vi.mocked(p.text)
			.mockResolvedValueOnce('my-web-fullstack-app')
			.mockResolvedValueOnce('./out')
			.mockResolvedValueOnce('A cool fullstack app')
			.mockResolvedValueOnce('fullstack, react, express')
			.mockResolvedValueOnce('Test Author');
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

		// Order: ProjectName (text), Directory (text), Description (text), Keywords (text), Author (text), Action (select), Template (select), Deps (confirm), CI (confirm), GH (confirm)
		vi.mocked(p.text)
			.mockResolvedValueOnce(projectName)
			.mockResolvedValueOnce('.')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('Test Author');
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
			.mockResolvedValueOnce('Test Author');
		vi.mocked(p.select).mockResolvedValueOnce('web-app').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(false);
		const result = await parseArgs();
		expect(result.template).toBe('web-app');
		expect(result.author).toBe('Test Author');
	});

	it('should handle full interactive flow', async () => {
		process.argv.push('interactive');
		vi.mocked(p.text)
			.mockResolvedValueOnce('full-test')
			.mockResolvedValueOnce('.')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('')
			.mockResolvedValueOnce('Test Author');
		vi.mocked(p.select).mockResolvedValueOnce('cli').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(true);
		const result = await parseArgs();
		expect(result.build).toBe(true);
		expect(result.installDependencies).toBe(true);
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
			.mockResolvedValueOnce('Test Author');
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

	it.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])('should handle cancel at prompt stage %i', async (stage) => {
		vi.resetAllMocks();
		process.argv = [...originalArgv.slice(0, 2), 'interactive'];
		const exitSpyLocal = vi.spyOn(process, 'exit').mockImplementation((code) => {
			const err: any = new Error(`Process exited with code ${code}`);
			err.code = code === 0 ? 'PROCESS_EXIT_0' : 'PROCESS_EXIT_1';
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

		await expect(parseArgs()).rejects.toThrow('Process exited with code');
		expect(p.cancel).toHaveBeenCalledWith('Operation cancelled.');

		await fs.rm(projectDir, {recursive: true, force: true});
		exitSpyLocal.mockRestore();
	});

	it('should handle update command with specific options', async () => {
		const tempDir = path.resolve('./temp-update-opts-test');
		await fs.mkdir(tempDir, {recursive: true});
		await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({name: 'upd-test', author: 'Test Author'}));

		process.argv.push('update', '-t', 'web-app', '-d', tempDir, '--no-progress');
		const result = await parseArgs();
		expect(result.update).toBe(true);
		expect(result.template).toBe('web-app');
		expect(result.progress).toBe(false);
		expect(result.projectName).toBe('upd-test');
		expect(result.author).toBe('Test Author');
		expect(result.directory).toBe(tempDir);

		await fs.rm(tempDir, {recursive: true, force: true});
	});

	it('should exit if update run in directory with package.json missing name', async () => {
		const tempDir = path.resolve('./temp-no-name');
		await fs.mkdir(tempDir, {recursive: true});
		await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({version: '1.0.0', author: 'Test Author'}));

		process.argv.push('update', '-t', 'cli', '-d', tempDir);
		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('No name property found'));

		await fs.rm(tempDir, {recursive: true, force: true});
	});

	it('should validate project name in interactive mode', async () => {
		process.argv.push('interactive');
		let capturedValidate: any;
		vi.mocked(p.text).mockImplementation(async (opts: any) => {
			if (opts.message === 'Project name:') {
				capturedValidate = opts.validate;
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
		expect(capturedValidate('')).toBe('Project name is required');
		expect(result.projectName).toBe('valid-name');
		expect(result.author).toBe('mock-response');
		expect(result.packageManager).toBe('npm');
	});

	it('should handle --debug option', async () => {
		process.argv.push('create', '-t', 'cli', '-n', 'debug-test', '--path', './debug-test-dir', '-a', 'Test Author', '--debug');
		await parseArgs();
		expect(process.env['DEBUG']).toContain('create-template-project:*');
		expect(debugLib.enable).toHaveBeenCalledWith('create-template-project:*');
	});

	it('should handle error reading existing package.json in interactive mode', async () => {
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
		vi.mocked(p.select).mockResolvedValueOnce('update').mockResolvedValueOnce('cli').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(true);

		const result = await parseArgs();
		expect(result.projectName).toBe(projectName);
		expect(result.author).toBe('Test Author');

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
