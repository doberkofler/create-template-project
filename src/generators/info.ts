import {type TemplateType, type ProjectOptions} from '#shared/types.js';
import {getBaseTemplate} from '#templates/base/index.js';
import {getTemplateByType, getTemplateTypes} from '#templates/registry.js';

const MOCK_OPTS: ProjectOptions = {
	template: 'cli',
	projectName: 'mock',
	author: 'mock',
	githubUsername: 'mock',
	directory: '.',
	packageManager: 'npm',
	update: false,
	build: false,
	progress: true,
	createGithubRepository: false,
};

export type AggregatedTemplateInfo = {
	name: string;
	description: string;
	components: {name: string; description: string}[];
};

export const getTemplateInfo = (type: TemplateType): AggregatedTemplateInfo => {
	const opts = {...MOCK_OPTS, template: type};
	const base = getBaseTemplate(opts);
	const template = getTemplateByType(type, opts);

	return {
		name: template.name,
		description: template.description,
		components: [...base.components, ...template.components],
	};
};

export const getAllTemplatesInfo = (): AggregatedTemplateInfo[] => getTemplateTypes().map((type) => getTemplateInfo(type));
