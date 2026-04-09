import {type ContentProcessor} from './types.js';

export const oxcConfigProcessor: ContentProcessor = (content, {filePath, opts}) => {
	if (filePath !== 'oxc.config.ts') {
		return content;
	}

	const shouldAddNodeEnv = opts.template === 'cli' || opts.template === 'web-fullstack';
	const shouldAddBrowserEnv = opts.template === 'web-vanilla' || opts.template === 'web-app' || opts.template === 'web-fullstack';

	const linesToAdd: string[] = [];
	if (shouldAddNodeEnv && !content.includes('node: true')) {
		linesToAdd.push('\t\tnode: true,');
	}
	if (shouldAddBrowserEnv && !content.includes('browser: true')) {
		linesToAdd.push('\t\tbrowser: true,');
	}

	if (linesToAdd.length === 0) {
		return content;
	}

	const envBlocks = ['\tenv: {\n\t\tbuiltin: true,\n', 'env: {\n\t\tbuiltin: true,\n'];

	for (const envBlock of envBlocks) {
		if (content.includes(envBlock)) {
			return content.replace(envBlock, `${envBlock}${linesToAdd.join('\n')}\n`);
		}
	}

	return content;
};
