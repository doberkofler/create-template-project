import {defineConfig} from 'tsdown';

export default defineConfig({
	entry: ['./src/index.ts'],
	format: 'esm',
	platform: 'node',
	dts: true,
	unbundle: true,
	external: [/^[^./]/], // Mark all non-relative imports as external
});
