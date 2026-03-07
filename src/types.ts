import {z} from 'zod';

export const TemplateTypeSchema = z.enum(['cli', 'webpage', 'webapp', 'fullstack']);
export type TemplateType = z.infer<typeof TemplateTypeSchema>;

export const PackageManagerSchema = z.enum(['npm', 'pnpm', 'yarn']);
export type PackageManagerType = z.infer<typeof PackageManagerSchema>;

export interface ProjectOptions {
	template: TemplateType;
	projectName: string;
	packageManager?: PackageManagerType;
	createGithubRepository?: boolean;
	directory: string;
	force?: boolean;
	overwrite?: boolean;
	update?: boolean;
	skipBuild?: boolean;
	installDependencies?: boolean;
	build?: boolean;
	dev?: boolean;
	open?: boolean;
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
	templateDir?: string;
}

export interface DependencyConfig {
	dependencies: Record<
		string,
		{
			version: string;
			description: string;
		}
	>;
}
