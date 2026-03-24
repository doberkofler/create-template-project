import {ContentProcessor} from './types.js';

export const contributingProcessor: ContentProcessor = (content, {filePath, addedDeps}) => {
	if (filePath !== 'CONTRIBUTING.md' || addedDeps.length === 0) {
		return content;
	}

	let processed = content;
	processed += '\n## Dependencies\n\n';
	const uniqueDeps = Array.from(new Set(addedDeps.map((d) => JSON.stringify(d)))).map((s) => JSON.parse(s)) as Array<{
		name: string;
		description: string;
	}>;
	for (const dep of uniqueDeps) {
		processed += `- **${dep.name}**: ${dep.description}\n`;
	}
	return processed;
};
