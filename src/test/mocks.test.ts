import {describe, it, expect, expectTypeOf, vi} from 'vitest';
import {createCodedError, createDebugMock, createPromptsMock, createTemplateInfoMock} from './mocks.js';

type SpinnerMock = {
	start: (message?: string) => void;
	stop: (message?: string, code?: number) => void;
	message: (message: string) => void;
};

type PromptsMock = Record<string, unknown> & {
	isCancel: (value: unknown) => boolean;
	spinner: () => SpinnerMock;
};

const assertPromptsMock: (value: Record<string, unknown>) => asserts value is PromptsMock = (value) => {
	if (typeof value.isCancel !== 'function') {
		throw new TypeError('mock.isCancel should be a function');
	}

	if (typeof value.spinner !== 'function') {
		throw new TypeError('mock.spinner should be a function');
	}
};

describe('test/mocks', () => {
	it('creates coded errors with optional exit code', () => {
		const errorWithExitCode = createCodedError('boom', 'E_BANG', 2);
		expect(errorWithExitCode.message).toBe('boom');
		expect(errorWithExitCode.code).toBe('E_BANG');
		expect(errorWithExitCode.exitCode).toBe(2);

		const errorWithoutExitCode = createCodedError('boom', 'E_BANG');
		expect(errorWithoutExitCode.exitCode).toBeUndefined();
	});

	it('creates a debug module mock with enable/disable helpers', () => {
		const {default: debugModule} = createDebugMock();
		const logger = debugModule('my:namespace');

		expectTypeOf(logger).toBeFunction();
		expect(debugModule).toHaveBeenCalledWith('my:namespace');

		debugModule.enable('my:*');
		debugModule.disable();

		expect(debugModule.enable).toHaveBeenCalledWith('my:*');
		expect(debugModule.disable).toHaveBeenCalled();
	});

	it('creates template info mocks for list and single template lookups', () => {
		const templateInfo = createTemplateInfoMock();

		expect(templateInfo.getAllTemplatesInfo()).toEqual([
			{
				name: 'cli',
				description: 'desc',
				components: [{name: 'c1', description: 'd1'}],
			},
		]);
		expect(templateInfo.getTemplateInfo()).toEqual({
			name: 'cli',
			description: 'desc',
			components: [{name: 'c1', description: 'd1'}],
		});
	});

	it('creates prompts mocks with spinner and cancel detection', async () => {
		const mock = await createPromptsMock(async () => {
			await Promise.all([]);
			return {existing: 'value'};
		});
		assertPromptsMock(mock);

		expect(mock).toMatchObject({existing: 'value'});
		expect(mock.isCancel(Symbol('cancel'))).toBe(true);
		expect(mock.isCancel('keep-going')).not.toBe(true);

		const spinner = mock.spinner();
		spinner.start('starting');
		spinner.message('running');
		spinner.stop('done', 0);

		expect(vi.mocked(spinner.start)).toHaveBeenCalledWith('starting');
		expect(vi.mocked(spinner.message)).toHaveBeenCalledWith('running');
		expect(vi.mocked(spinner.stop)).toHaveBeenCalledWith('done', 0);
	});
});
