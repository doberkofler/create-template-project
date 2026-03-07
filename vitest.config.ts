import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		exclude: ['**/node_modules/**', '**/dist/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov', 'clover'],
			include: ['src/**/*.ts'],
			exclude: ['src/types.ts', '**/*.test.ts', 'src/templates/**/files/**'],
			thresholds: {
				lines: 90,
				functions: 90,
				statements: 90,
				branches: 80,
			},
		},
	},
});
