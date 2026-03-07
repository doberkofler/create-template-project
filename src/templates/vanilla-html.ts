import {TemplateDefinition} from '../types.js';

export const getVanillaHtmlTemplate = (): TemplateDefinition => ({
	name: 'vanilla-html',
	dependencies: {},
	devDependencies: {
		tsdown: '^0.20.3',
	},
	scripts: {
		build: 'tsdown',
	},
	files: [
		{
			path: 'index.html',
			content: `<!DOCTYPE html>
<html>
<head><title>Vanilla HTML</title></head>
<body>
	<h1>Vanilla HTML Template</h1>
	<script src="./dist/index.js"></script>
</body>
</html>
`,
		},
		{
			path: 'src/index.ts',
			content: "console.log('Hello from Vanilla HTML!');\n",
		},
	],
});
