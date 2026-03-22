import {TemplateType, TemplateDefinition, ProjectOptions} from '../types.js';
import {getBaseTemplate} from '../templates/base/index.js';
import {getCliTemplate} from '../templates/cli/index.js';
import {getWebVanillaTemplate} from '../templates/web-vanilla/index.js';
import {getWebAppTemplate} from '../templates/web-app/index.js';
import {getWebFullstackTemplate} from '../templates/web-fullstack/index.js';

const MOCK_OPTS: ProjectOptions = {
	template: 'cli',
	projectName: 'mock',
	directory: '.',
	packageManager: 'npm',
	update: false,
	installDependencies: false,
	build: false,
	progress: true,
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
		case 'web-vanilla':
			template = getWebVanillaTemplate(opts);
			break;
		case 'web-app':
			template = getWebAppTemplate(opts);
			break;
		case 'web-fullstack':
			template = getWebFullstackTemplate(opts);
			break;
	}

	return {
		name: template.name,
		description: template.description,
		components: [...base.components, ...template.components],
	};
};

export const getAllTemplatesInfo = (): AggregatedTemplateInfo[] => {
	return ['cli', 'web-vanilla', 'web-app', 'web-fullstack'].map((type) => getTemplateInfo(type as TemplateType));
};
