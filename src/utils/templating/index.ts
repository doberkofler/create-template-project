import {ProjectOptions} from '../../types.js';
import {AddedDependency, ProcessorContext, ContentProcessor} from './types.js';
import {genericProcessor} from './generic.js';
import {githubWorkflowProcessor} from './github-workflow.js';
import {tsconfigProcessor} from './tsconfig.js';
import {contributingProcessor} from './contributing.js';
import {webVanillaHtmlProcessor} from './web-vanilla-html.js';

const processors: ContentProcessor[] = [genericProcessor, githubWorkflowProcessor, tsconfigProcessor, contributingProcessor, webVanillaHtmlProcessor];

export function processContent(filePath: string, content: string, opts: ProjectOptions, addedDeps: AddedDependency[]): string {
	const context: ProcessorContext = {
		filePath,
		opts,
		addedDeps,
	};

	return processors.reduce((acc, processor) => processor(acc, context), content);
}
