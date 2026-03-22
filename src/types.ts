import {z} from 'zod';

export const TemplateTypeSchema = z.enum(['cli', 'web-vanilla', 'web-app', 'web-fullstack']);
export type TemplateType = z.infer<typeof TemplateTypeSchema>;

export const PackageManagerSchema = z.enum(['npm', 'pnpm', 'yarn']);
export type PackageManagerType = z.infer<typeof PackageManagerSchema>;

export const ProjectOptionsSchema = z.object({
	template: TemplateTypeSchema,
	projectName: z.string().min(1, 'Project name is required'),
	packageManager: PackageManagerSchema.optional().default('npm'),
	createGithubRepository: z.boolean().optional().default(false),
	directory: z.string(),
	update: z.boolean().optional().default(false),
	installDependencies: z.boolean().optional().default(false),
	build: z.boolean().optional().default(false),
	progress: z.boolean().optional().default(true),
});

export type ProjectOptions = z.infer<typeof ProjectOptionsSchema>;

export interface FileDefinition {
	path: string;
	content: string | (() => string);
}

export interface TemplateComponent {
	name: string;
	description: string;
}

export interface TemplateDefinition {
	name: string;
	description: string;
	components: TemplateComponent[];
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
	files: FileDefinition[];
	scripts: Record<string, string>;
	workspaces?: string[];
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
