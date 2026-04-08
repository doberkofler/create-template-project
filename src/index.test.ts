import {describe, it, expect, vi, beforeEach, type MockInstance} from 'vitest';
import {main} from './index.js';
import * as p from '@clack/prompts';
import {parseArgs} from './cli.js';
import {generateProject} from './generators/project.js';

vi.mock('./cli.js');
vi.mock('./generators/project.js');
vi.mock('@clack/prompts', async (importOriginal) => {
	const actual = (await importOriginal()) as any;
	return {
		...actual,
		intro: vi.fn<any>(),
		outro: vi.fn<any>(),
		cancel: vi.fn<any>(),
		note: vi.fn<any>(),
		log: {
			success: vi.fn<any>(),
			error: vi.fn<any>(),
			warn: vi.fn<any>(),
			info: vi.fn<any>(),
		},
	};
});

describe('index', () => {
	let exitSpy: MockInstance<any>;

	beforeEach(() => {
		vi.clearAllMocks();
		exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
			throw new Error(`Process exited with code ${code}`);
		});
	});

	it('should run successfully', async () => {
		const opts = {projectName: 'test', template: 'cli'};
		vi.mocked(parseArgs).mockResolvedValue(opts as any);

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
		const err: any = new Error('Exit 0');
		err.code = 'PROCESS_EXIT_0';
		vi.mocked(parseArgs).mockRejectedValue(err);

		await expect(main()).rejects.toThrow('Process exited with code 0');
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it('should handle PROCESS_EXIT_1 error', async () => {
		const err: any = new Error('Exit 1');
		err.code = 'PROCESS_EXIT_1';
		vi.mocked(parseArgs).mockRejectedValue(err);

		await expect(main()).rejects.toThrow('Process exited with code 1');
		expect(exitSpy).toHaveBeenCalledWith(1);
	});

	it('should handle commander helpDisplayed error', async () => {
		const err: any = new Error('Help');
		err.code = 'commander.helpDisplayed';
		vi.mocked(parseArgs).mockRejectedValue(err);

		await expect(main()).rejects.toThrow('Process exited with code 0');
		expect(exitSpy).toHaveBeenCalledWith(0);
	});

	it('should handle commander version error', async () => {
		const err: any = new Error('Version');
		err.code = 'commander.version';
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
