import {defineConfig} from 'tsdown';

export default defineConfig({
	entry: {
		server: 'backend/src/index.ts',
		client: 'frontend/src/index.ts',
	},
	format: ['esm'],
	clean: true,
});
