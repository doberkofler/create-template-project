import {ProjectOptions} from '../../types.js';

export interface AddedDependency {
	name: string;
	description: string;
}

export interface ProcessorContext {
	filePath: string;
	opts: ProjectOptions;
	addedDeps: AddedDependency[];
}

export type ContentProcessor = (content: string, context: ProcessorContext) => string;
