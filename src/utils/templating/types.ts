import {type ProjectOptions} from '#shared/types.js';

export type AddedDependency = {
	name: string;
	description: string;
};

export type ProcessorContext = {
	filePath: string;
	opts: ProjectOptions;
	addedDeps: AddedDependency[];
};

export type ContentProcessor = (content: string, context: ProcessorContext) => string;
