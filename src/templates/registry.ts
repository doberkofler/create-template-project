import {getBaseTemplate} from '#templates/base/index.js';
import {getCliTemplate} from '#templates/cli/index.js';
import {getWebVanillaTemplate} from '#templates/web-vanilla/index.js';
import {getWebAppTemplate} from '#templates/web-app/index.js';
import {getWebFullstackTemplate} from '#templates/web-fullstack/index.js';
import {type ProjectOptions, type TemplateDefinition, type TemplateType} from '#shared/types.js';

type TemplateFactory = (opts: ProjectOptions) => TemplateDefinition;

const templateFactories: Readonly<Record<TemplateType, TemplateFactory>> = {
	cli: getCliTemplate,
	'web-vanilla': getWebVanillaTemplate,
	'web-app': getWebAppTemplate,
	'web-fullstack': getWebFullstackTemplate,
};

export const getTemplateByType = (type: TemplateType, opts: ProjectOptions): TemplateDefinition => templateFactories[type](opts);

export const getProjectTemplates = (opts: ProjectOptions): TemplateDefinition[] => [getBaseTemplate(opts), getTemplateByType(opts.template, opts)];

export const getTemplateTypes = (): readonly TemplateType[] => ['cli', 'web-vanilla', 'web-app', 'web-fullstack'] as const;
