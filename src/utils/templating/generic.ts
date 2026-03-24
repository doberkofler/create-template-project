import {ContentProcessor} from './types.js';

export const genericProcessor: ContentProcessor = (content, {opts}) => {
	const {projectName, template, author, githubUsername} = opts;
	let description = opts.description || '';

	if (!description) {
		switch (template) {
			case 'cli':
				description = 'A modern Node.js CLI application with TypeScript and automated tooling.';
				break;
			case 'web-vanilla':
				description = 'A standalone web page/application for modern browsers.';
				break;
			case 'web-fullstack':
				description = 'A full-stack monorepo with an Express server and a React/MUI client.';
				break;
			case 'web-app':
				description = 'A React application with MUI and TanStack Query.';
				break;
		}
	}

	const pm = opts.packageManager || 'npm';
	const lockfileRules = pm === 'pnpm' ? 'package-lock.json\nyarn.lock' : pm === 'yarn' ? 'package-lock.json\npnpm-lock.yaml' : 'yarn.lock\npnpm-lock.yaml';

	return content
		.replaceAll('{{projectName}}', projectName)
		.replaceAll('{{description}}', description)
		.replaceAll('{{packageManager}}', pm)
		.replaceAll('{{author}}', author || '')
		.replaceAll('{{githubUsername}}', githubUsername || '')
		.replaceAll('{{year}}', new Date().getFullYear().toString())
		.replaceAll('{{lockfileRules}}', lockfileRules);
};
