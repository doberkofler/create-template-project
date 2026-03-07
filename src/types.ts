import {z} from 'zod';

export const TemplateTypeSchema = z.enum(['node', 'vanilla-html', 'vanilla-js', 'react']);
export type TemplateType = z.infer<typeof TemplateTypeSchema>;

export interface ProjectOptions {
	template: TemplateType;
	projectName: string;
	createGithub: boolean;
	directory: string;
}

export interface FileDefinition {
	path: string;
	content: string | (() => string);
}

export interface TemplateDefinition {
	name: string;
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
	files: FileDefinition[];
	scripts: Record<string, string>;
}
