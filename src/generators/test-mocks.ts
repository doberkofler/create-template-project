import {vi} from 'vitest';

type ImportOriginal = () => Promise<Record<string, unknown>>;

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
