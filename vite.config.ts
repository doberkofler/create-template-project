import {defineConfig} from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	build: {
		ssr: true,
		lib: {
			entry: path.resolve(__dirname, 'src/index.ts'),
			formats: ['es'],
			fileName: 'index',
		},
		outDir: 'dist',
		emptyOutDir: true,
		target: 'node22',
	},
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
