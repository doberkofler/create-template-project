import {describe, it, expect, vi, beforeEach, type MockInstance} from 'vitest';
import {main} from './index.js';
import * as p from '@clack/prompts';
import {parseArgs} from './cli.js';
import {generateProject} from './generators/project.js';
import {type ProjectOptions} from '#shared/types.js';
import {createCodedError} from './test/mocks.js';

vi.mock(import('./cli.js'));
vi.mock(import('./generators/project.js'));
vi.mock(import('@clack/prompts'), async (importOriginal) => {
	const {createPromptsMock} = await import('./test/mocks.js');
	return createPromptsMock(importOriginal as () => Promise<Record<string, unknown>>);
});

describe('index', () => {
	let exitSpy: MockInstance<(code?: string | number | null) => never>;

	beforeEach(() => {
		vi.clearAllMocks();
		exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
			throw new Error(`Process exited with code ${code}`);
		});
	});

	it('should run successfully', async () => {
		const opts: ProjectOptions = {
			template: 'cli',
			projectName: 'test',
			author: 'Test Author',
			githubUsername: 'test-user',
			packageManager: 'pnpm',
			createGithubRepository: false,
			directory: '/tmp/test',
			update: false,
			build: false,
			progress: true,
		};
		vi.mocked(parseArgs).mockResolvedValue(opts);

		await main();

		expect(p.intro).toHaveBeenCalled();
		expect(parseArgs).toHaveBeenCalled();
		expect(generateProject).toHaveBeenCalledWith(opts);
		expect(p.outro).toHaveBeenCalled();
	});

	it('should handle errors and exit', async () => {
		vi.mocked(parseArgs).mockRejectedValue(new Error('Test error'));

		await expect(main()).rejects.toThrow('Process exited with code 1');

		expect(p.cancel).toHaveBeenCalledWith('Test error');
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it('should handle PROCESS_EXIT_0 error', async () => {
		const err = createCodedError('Exit 0', 'PROCESS_EXIT_0');
		vi.mocked(parseArgs).mockRejectedValue(err);

		await expect(main()).rejects.toThrow('Process exited with code 0');
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it('should handle PROCESS_EXIT_1 error', async () => {
		const err = createCodedError('Exit 1', 'PROCESS_EXIT_1');
		vi.mocked(parseArgs).mockRejectedValue(err);

		await expect(main()).rejects.toThrow('Process exited with code 1');
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it('should handle commander helpDisplayed error', async () => {
		const err = createCodedError('Help', 'commander.helpDisplayed');
		vi.mocked(parseArgs).mockRejectedValue(err);

		await expect(main()).rejects.toThrow('Process exited with code 0');
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it('should handle commander version error', async () => {
		const err = createCodedError('Version', 'commander.version');
		vi.mocked(parseArgs).mockRejectedValue(err);

		await expect(main()).rejects.toThrow('Process exited with code 0');
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it('should handle string errors in main', async () => {
		vi.mocked(parseArgs).mockRejectedValue('String error');

		await expect(main()).rejects.toThrow('Process exited with code 1');
		expect(p.cancel).toHaveBeenCalledWith('String error');
	});

	it('should handle errors without message in main', async () => {
		vi.mocked(parseArgs).mockRejectedValue({});

		await expect(main()).rejects.toThrow('Process exited with code 1');
		expect(p.cancel).toHaveBeenCalledWith('[object Object]');
	});
});
