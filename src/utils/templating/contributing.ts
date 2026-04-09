import {type ContentProcessor} from './types.js';

export const contributingProcessor: ContentProcessor = (content, {filePath, addedDeps}) => {
	if (filePath !== 'CONTRIBUTING.md' || addedDeps.length === 0) {
		return content;
	}

	let processed = content;
	processed += '\n## Dependencies\n\n';
	const uniqueDepsByName = new Map(addedDeps.map((dep) => [dep.name, dep]));
	const uniqueDeps = [...uniqueDepsByName.values()];
	for (const dep of uniqueDeps) {
		processed += `- **${dep.name}**: ${dep.description}\n`;
	}
	return processed;
};
