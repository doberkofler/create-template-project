import {TemplateType, TemplateDefinition, ProjectOptions} from '../types.js';
import {getBaseTemplate} from '../templates/base/index.js';
import {getCliTemplate} from '../templates/cli/index.js';
import {getWebpageTemplate} from '../templates/webpage/index.js';
import {getWebappTemplate} from '../templates/webapp/index.js';
import {getFullstackTemplate} from '../templates/fullstack/index.js';

const MOCK_OPTS: ProjectOptions = {
	template: 'cli',
	projectName: 'mock',
	directory: '.',
	packageManager: 'npm',
	overwrite: false,
	update: false,
	skipBuild: false,
	installDependencies: false,
	build: false,
	dev: false,
	open: false,
	silent: true,
	createGithubRepository: false,
};

export interface AggregatedTemplateInfo {
	name: string;
	description: string;
	components: {name: string; description: string}[];
}

export const getTemplateInfo = (type: TemplateType): AggregatedTemplateInfo => {
	const opts = {...MOCK_OPTS, template: type};
	const base = getBaseTemplate(opts);
	let template: TemplateDefinition;

	switch (type) {
		case 'cli':
			template = getCliTemplate(opts);
			break;
		case 'webpage':
			template = getWebpageTemplate(opts);
			break;
		case 'webapp':
			template = getWebappTemplate(opts);
			break;
		case 'fullstack':
			template = getFullstackTemplate(opts);
			break;
	}

	return {
		name: template.name,
		description: template.description,
		components: [...base.components, ...template.components],
	};
};

export const getAllTemplatesInfo = (): AggregatedTemplateInfo[] => {
	return ['cli', 'webpage', 'webapp', 'fullstack'].map((type) => getTemplateInfo(type as TemplateType));
};
