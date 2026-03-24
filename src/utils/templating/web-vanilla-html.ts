import {ContentProcessor} from './types.js';

export const webVanillaHtmlProcessor: ContentProcessor = (content, {filePath, opts}) => {
	if (opts.template === 'web-vanilla' && filePath === 'index.html') {
		return content.replace('{{scriptSrc}}', '/src/index.ts');
	}
	return content;
};
