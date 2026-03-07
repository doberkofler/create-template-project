import {TemplateDefinition} from '../types.js';

export const getNodeTemplate = (): TemplateDefinition => ({
	name: 'node',
	dependencies: {
		commander: '^14.0.3',
		'cli-progress': '^3.12.0',
	},
	devDependencies: {
		tsdown: '^0.20.3',
		'@types/cli-progress': '^3.11.6',
	},
	scripts: {
		dev: 'tsdown --watch',
		build: 'tsdown',
	},
	files: [
		{
			path: 'tsdown.config.ts',
			content:
				"import { defineConfig } from 'tsdown';\n\nexport default defineConfig({ entry: ['./src/index.ts'], format: ['esm'], clean: true, dts: true });\n",
		},
		{
			path: 'src/index.ts',
			content: `import { Command } from 'commander';
import { SingleBar, Presets } from 'cli-progress';

const program = new Command();
program.name('my-cli').description('A sample CLI');
program.parse();

const bar = new SingleBar({}, Presets.shades_classic);
bar.start(100, 0);
bar.update(50);
bar.stop();

console.log('Hello from Node.js template!');
`,
		},
		{
			path: 'src/index.test.ts',
			content: "import { expect, test } from 'vitest';\n\ntest('math works', () => { expect(1 + 1).toBe(2); });\n",
		},
	],
});
