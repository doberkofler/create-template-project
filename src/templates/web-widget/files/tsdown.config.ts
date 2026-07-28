import {defineConfig} from 'tsdown';

export default defineConfig({
	entry: {
		index: 'src/lib/index.ts',
		react: 'src/lib/react.tsx',
	},
	deps: {
		neverBundle: ['react', 'react/jsx-runtime'],
	},
	format: ['esm'],
	dts: true,
	fixedExtension: true,
	outDir: 'dist',
	clean: true,
	target: 'es2022',
	platform: 'neutral',
	sourcemap: true,
	copy: [{from: 'src/styles/index.css', to: 'dist/styles', flatten: true}],
});
