import {vi} from 'vitest';

type ImportOriginal = () => Promise<Record<string, unknown>>;

type DebugFactory = ((namespace: string) => (...args: unknown[]) => void) & {
	enable: (namespaces: string) => void;
	disable: () => void;
};

type TemplateInfo = {
	name: string;
	description: string;
	components: {name: string; description: string}[];
};

export type CodedError = Error & {
	code?: string;
	exitCode?: number;
};

export const createCodedError = (message: string, code: string, exitCode?: number): CodedError => {
	const error = new Error(message) as CodedError;
	error.code = code;
	if (typeof exitCode === 'number') {
		error.exitCode = exitCode;
	}
	return error;
};

export const createPromptsMock = async (importOriginal: ImportOriginal): Promise<Record<string, unknown>> => {
	const actual = await importOriginal();

	return {
		...actual,
		intro: vi.fn<(message?: string) => void>(),
		outro: vi.fn<(message?: string) => void>(),
		select: vi.fn<(options?: Record<string, unknown>) => Promise<string>>(),
		text: vi.fn<(options?: Record<string, unknown>) => Promise<string>>(),
		confirm: vi.fn<(options?: Record<string, unknown>) => Promise<boolean>>(),
		isCancel: vi.fn<(value: unknown) => value is symbol>((value: unknown): value is symbol => typeof value === 'symbol'),
		cancel: vi.fn<(message?: string) => void>(),
		note: vi.fn<(message?: string | string[], title?: string) => void>(),
		spinner: vi.fn<
			() => {
				start: (message?: string) => void;
				stop: (message?: string, code?: number) => void;
				message: (message: string) => void;
			}
		>(() => ({
			start: vi.fn<(message?: string) => void>(),
			stop: vi.fn<(message?: string, code?: number) => void>(),
			message: vi.fn<(message: string) => void>(),
		})),
		log: {
			success: vi.fn<(message: string) => void>(),
			error: vi.fn<(message: string) => void>(),
			warn: vi.fn<(message: string) => void>(),
			info: vi.fn<(message: string) => void>(),
		},
	};
};

export const createDebugMock = (): {default: DebugFactory} => {
	const debugModule: DebugFactory = Object.assign(
		vi.fn<(namespace: string) => (...args: unknown[]) => void>(() => vi.fn<(...args: unknown[]) => void>()),
		{
			enable: vi.fn<(namespaces: string) => void>(),
			disable: vi.fn<() => void>(),
		},
	);

	return {
		default: debugModule,
	};
};

export const createTemplateInfoMock = (): {
	getAllTemplatesInfo: () => TemplateInfo[];
	getTemplateInfo: () => TemplateInfo;
} => ({
	getAllTemplatesInfo: vi.fn<() => TemplateInfo[]>(() => [
		{
			name: 'cli',
			description: 'desc',
			components: [{name: 'c1', description: 'd1'}],
		},
	]),
	getTemplateInfo: vi.fn<() => TemplateInfo>(() => ({
		name: 'cli',
		description: 'desc',
		components: [{name: 'c1', description: 'd1'}],
	})),
});
