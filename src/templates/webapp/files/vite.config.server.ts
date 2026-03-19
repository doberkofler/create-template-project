import {defineConfig} from 'vitest/config';
import path from 'node:path';

export default defineConfig({
	build: {
		lib: {
			entry: path.resolve(__dirname, 'backend/src/index.ts'),
			formats: ['es'],
			fileName: 'index',
		},
		outDir: 'dist/server',
		emptyOutDir: false,
		rollupOptions: {
			external: ['express', 'node:path', 'node:url'],
		},
	},
});
