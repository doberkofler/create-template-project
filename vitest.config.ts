import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		exclude: ['**/node_modules/**', '**/dist/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: ['src/types.ts', 'src/index.test.ts', 'src/lint.test.ts', 'src/report-console.test.ts', 'src/report-html.test.ts', 'src/rules.test.ts'],
			thresholds: {
				lines: 10,
				functions: 10,
				statements: 10,
				branches: 10,
			},
		},
	},
});
