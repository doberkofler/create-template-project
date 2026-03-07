import {TemplateDefinition} from '../types.js';

export const getVanillaJsTemplate = (): TemplateDefinition => ({
	name: 'vanilla-js',
	dependencies: {
		express: '^4.21.0',
	},
	devDependencies: {
		'@types/express': '^4.17.21',
		tsdown: '^0.20.3',
	},
	scripts: {
		build: 'tsdown',
		start: 'node dist/server/index.js',
	},
	files: [
		{
			path: 'backend/src/index.ts',
			content: `import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

app.listen(port, () => {
  console.log(\`Server running at http://localhost:\${port}\`);
});
`,
		},
		{
			path: 'frontend/src/index.ts',
			content: `console.log('Hello from Vanilla JS Frontend!');
fetch('/api/hello')
	.then(res => res.json())
	.then(data => console.log(data.message));
`,
		},
		{
			path: 'frontend/index.html',
			content: `<!DOCTYPE html>
<html>
<head><title>Vanilla JS Template</title></head>
<body>
	<h1>Vanilla JS Template</h1>
	<script src="./dist/index.js"></script>
</body>
</html>
`,
		},
	],
});
