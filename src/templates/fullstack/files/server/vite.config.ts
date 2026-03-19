import {defineConfig} from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	build: {
		lib: {
			entry: path.resolve(__dirname, 'src/index.ts'),
			formats: ['es'],
			fileName: 'index',
		},
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			external: ['express', 'cors', 'zod', '@trpc/server', 'node:path', 'node:url'],
		},
	},
	test: {
		globals: true,
		environment: 'node',
	},
});
