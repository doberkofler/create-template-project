import {type ProjectOptions} from '#shared/types.js';
import {type AddedDependency, type ProcessorContext, type ContentProcessor} from './types.js';
import {genericProcessor} from './generic.js';
import {githubWorkflowProcessor} from './github-workflow.js';
import {tsconfigProcessor} from './tsconfig.js';
import {contributingProcessor} from './contributing.js';
import {webVanillaHtmlProcessor} from './web-vanilla-html.js';
import {oxcConfigProcessor} from './oxc-config.js';

const processors: ContentProcessor[] = [
	genericProcessor,
	githubWorkflowProcessor,
	tsconfigProcessor,
	contributingProcessor,
	webVanillaHtmlProcessor,
	oxcConfigProcessor,
];

export const processContent = (filePath: string, content: string, opts: ProjectOptions, addedDeps: AddedDependency[]): string => {
	const context: ProcessorContext = {
		filePath,
		opts,
		addedDeps,
	};

	let processed = content;
	for (const processor of processors) {
		processed = processor(processed, context);
	}
	return processed;
};
