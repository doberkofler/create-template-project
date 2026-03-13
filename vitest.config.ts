import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		exclude: ['**/node_modules/**', '**/dist/**', 'src/templates/**/files/**', 'temp/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov', 'clover'],
			exclude: ['**/*.test.ts', 'src/templates/**/files/**', 'temp/**'],
			thresholds: {
				lines: 90,
				functions: 90,
				statements: 90,
				branches: 80,
			},
		},
	},
});
