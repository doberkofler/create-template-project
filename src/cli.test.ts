import {describe, it, expect, vi, beforeEach, type MockInstance} from 'vitest';
import {parseArgs} from './cli.js';
import * as p from '@clack/prompts';
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

describe('cli', () => {
	const originalArgv = process.argv;
	let exitSpy: MockInstance<any>;

	beforeEach(() => {
		vi.resetAllMocks();
		process.argv = originalArgv.slice(0, 2);

		exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
			const err: any = new Error(`Process exited with code ${code}`);
			err.code = code === 0 ? 'PROCESS_EXIT_0' : 'PROCESS_EXIT_1';
			err.exitCode = code;
			throw err;
		});
		vi.mocked(p.isCancel).mockReturnValue(false);
	});

	it('should parse create command arguments', async () => {
		process.argv.push('create', '-t', 'cli', '-n', 'my-test-project', '-d', './test-dir');
		const result = await parseArgs();
		expect(result).toMatchObject({
			template: 'cli',
			projectName: 'my-test-project',
			directory: path.resolve('./test-dir'),
		});
	});

	it('should parse update command arguments', async () => {
		process.argv.push('update', '-t', 'webpage', '-n', 'existing-project');
		const result = await parseArgs();
		expect(result.update).toBe(true);
	});

	it('should handle interactive mode', async () => {
		process.argv.push('interactive');
		// Order: ProjectName (text), Directory (text), Template (select), PM (select), Tooling (confirm), Deps (confirm), CI (confirm), GH (confirm)
		vi.mocked(p.text).mockResolvedValueOnce('my-fullstack-app').mockResolvedValueOnce('./out');
		vi.mocked(p.select).mockResolvedValueOnce('fullstack').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(true);
		const result = await parseArgs();
		expect(result).toMatchObject({
			template: 'fullstack',
			projectName: 'my-fullstack-app',
		});
	});

	it('should exit if skip-build is used with webapp', async () => {
		process.argv.push('create', '-t', 'webapp', '-n', 'wa', '--skip-build');
		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
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

		// Order: ProjectName (text), Directory (text), Action (select), Template (select), Tooling (confirm), Deps (confirm), CI (confirm), GH (confirm)
		vi.mocked(p.text).mockResolvedValueOnce(projectName).mockResolvedValueOnce('.');
		vi.mocked(p.select).mockResolvedValueOnce('update').mockResolvedValueOnce('cli');
		vi.mocked(p.confirm).mockResolvedValue(false);

		const result = await parseArgs();
		expect(result.update).toBe(true);
		await fs.rm(projectDir, {recursive: true, force: true});
	});

	it('should handle webapp specifically in interactive', async () => {
		process.argv.push('interactive');
		vi.mocked(p.text).mockResolvedValueOnce('webapp-test').mockResolvedValueOnce('.');
		vi.mocked(p.select).mockResolvedValueOnce('webapp').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(false);
		const result = await parseArgs();
		expect(result.template).toBe('webapp');
		expect(result.skipBuild).toBe(false);
	});

	it('should handle full interactive flow', async () => {
		process.argv.push('interactive');
		vi.mocked(p.text).mockResolvedValueOnce('full-test').mockResolvedValueOnce('.');
		vi.mocked(p.select).mockResolvedValueOnce('cli').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(true);
		const result = await parseArgs();
		expect(result.build).toBe(true);
		expect(result.installDependencies).toBe(true);
	});

	it('should exit if mandatory options missing in create', async () => {
		process.argv.push('create', '-n', 'no-template');
		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		expect(p.cancel).toHaveBeenCalledWith(expect.stringContaining('template: Invalid option'));
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
				'create-template-project': {template: 'fullstack'},
			}),
		);

		vi.mocked(p.text).mockResolvedValueOnce(projectName).mockResolvedValueOnce('.');
		vi.mocked(p.select).mockResolvedValueOnce('update');
		// Should NOT prompt for template because it's found in package.json
		vi.mocked(p.confirm).mockResolvedValue(true);

		const result = await parseArgs();
		expect(result.template).toBe('fullstack');
		expect(p.log.info).toHaveBeenCalledWith(expect.stringContaining('Using existing template type: fullstack'));

		await fs.rm(projectDir, {recursive: true, force: true});
	});

	it('should exit if directory exists in create', async () => {
		const projectName = 'exists-non-interactive';
		const projectDir = path.resolve('.', projectName);
		await fs.mkdir(projectDir, {recursive: true});
		process.argv.push('create', '-t', 'cli', '-n', projectName);
		await expect(parseArgs()).rejects.toThrow('Process exited with code 1');
		await fs.rm(projectDir, {recursive: true, force: true});
	});

	it.each([0, 1, 2, 3, 4, 5, 6, 7])('should handle cancel at prompt stage %i', async (stage) => {
		vi.resetAllMocks();
		process.argv = [...originalArgv.slice(0, 2), 'interactive'];
		const exitSpyLocal = vi.spyOn(process, 'exit').mockImplementation((code) => {
			const err: any = new Error(`Process exited with code ${code}`);
			err.code = code === 0 ? 'PROCESS_EXIT_0' : 'PROCESS_EXIT_1';
			throw err;
		});

		let currentCall = 0;
		vi.mocked(p.isCancel).mockImplementation(() => currentCall++ === stage);

		vi.mocked(p.text).mockResolvedValueOnce('test').mockResolvedValueOnce('.');
		vi.mocked(p.select).mockResolvedValueOnce('update').mockResolvedValueOnce('cli').mockResolvedValueOnce('npm');
		vi.mocked(p.confirm).mockResolvedValue(true);

		const projectDir = path.resolve('.', 'test');
		await fs.mkdir(projectDir, {recursive: true});

		await expect(parseArgs()).rejects.toThrow('Process exited with code');
		expect(p.cancel).toHaveBeenCalledWith('Operation cancelled.');

		await fs.rm(projectDir, {recursive: true, force: true});
		exitSpyLocal.mockRestore();
	});

	it('should handle --open flag correctly', async () => {
		process.argv.push('create', '-t', 'cli', '-n', 'open-test', '--open');
		const result = await parseArgs();
		expect(result.open).toBe(true);
		expect(result.dev).toBe(true);
		expect(result.installDependencies).toBe(true);
	});

	it('should handle update command with specific options', async () => {
		process.argv.push('update', '-t', 'webapp', '-n', 'upd-test', '--silent');
		const result = await parseArgs();
		expect(result.update).toBe(true);
		expect(result.template).toBe('webapp');
		expect(result.silent).toBe(true);
	});

	it('should validate project name in interactive mode', async () => {
		process.argv.push('interactive');
		let capturedValidate: any;
		vi.mocked(p.text).mockImplementation(async (opts: any) => {
			if (opts.message === 'Project name:') {
				capturedValidate = opts.validate;
				return 'valid-name';
			}
			return 'test-dir';
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
		expect(result.directory).toBe(path.resolve('test-dir'));
		expect(result.packageManager).toBe('npm');
	});
});
