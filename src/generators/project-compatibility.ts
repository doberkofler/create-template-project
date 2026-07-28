import fs from 'node:fs/promises';
import path from 'node:path';
import {type TemplateType} from '#shared/types.js';

type PackageJson = {
	name?: string;
	type?: string;
	scripts?: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	workspaces?: string[];
	'create-template-project'?: {template?: TemplateType};
};

export type CompatibilityCheck = {
	id: string;
	label: string;
	passed: boolean;
	required: boolean;
};

export type CompatibilityReport = {
	directory: string;
	template: TemplateType;
	score: number;
	passed: boolean;
	checks: CompatibilityCheck[];
};

const PASS_THRESHOLD = 75;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const pathExists = async (filePath: string): Promise<boolean> => {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
};

const parseStringRecord = (value: unknown): Record<string, string> | undefined => {
	if (!isRecord(value)) {
		return undefined;
	}

	const parsed: Record<string, string> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (typeof entry === 'string') {
			parsed[key] = entry;
		}
	}
	return parsed;
};

const parsePackageJson = async (pkgPath: string): Promise<PackageJson | undefined> => {
	try {
		const parsed = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as unknown;
		if (!isRecord(parsed)) {
			return undefined;
		}

		return {
			name: typeof parsed.name === 'string' ? parsed.name : undefined,
			type: typeof parsed.type === 'string' ? parsed.type : undefined,
			scripts: parseStringRecord(parsed.scripts),
			dependencies: parseStringRecord(parsed.dependencies),
			devDependencies: parseStringRecord(parsed.devDependencies),
			workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces.filter((workspace): workspace is string => typeof workspace === 'string') : undefined,
		};
	} catch {
		return undefined;
	}
};

const hasAnyDependency = (pkg: PackageJson | undefined, dependency: string): boolean =>
	pkg?.dependencies?.[dependency] !== undefined || pkg?.devDependencies?.[dependency] !== undefined;

const requiredFilesByTemplate: Readonly<Record<TemplateType, readonly string[]>> = {
	cli: ['src/index.ts', 'src/index.test.ts', 'vite.config.ts'],
	'web-vanilla': ['index.html', 'src/index.ts', 'vite.config.ts', 'playwright.config.ts'],
	'web-app': ['index.html', 'src/index.tsx', 'src/App.tsx', 'vite.config.ts', 'playwright.config.ts'],
	'web-fullstack': ['client/package.json', 'server/package.json', 'client/src/main.tsx', 'server/src/index.ts'],
};

const requiredDependenciesByTemplate: Readonly<Record<TemplateType, readonly string[]>> = {
	cli: ['vite'],
	'web-vanilla': ['vite', 'vitest', 'playwright'],
	'web-app': ['react', 'react-dom', '@mui/material', 'vite'],
	'web-fullstack': ['express', '@trpc/server', 'react', 'react-dom'],
};

export const validateProjectCompatibility = async (directory: string, template: TemplateType): Promise<CompatibilityReport> => {
	const pkgPath = path.join(directory, 'package.json');
	const pkg = await parsePackageJson(pkgPath);
	const checks: CompatibilityCheck[] = [];

	const addCheck = (id: string, label: string, passed: boolean, required = false): void => {
		checks.push({id, label, passed, required});
	};

	addCheck('package-json', 'package.json exists and is valid JSON', pkg !== undefined, true);
	addCheck('package-name', 'package.json has a name', typeof pkg?.name === 'string' && pkg.name.length > 0, true);
	addCheck('esm', 'package.json uses ESM type module', pkg?.type === 'module');

	const commonFiles = ['tsconfig.json', 'vitest.config.ts', 'commitlint.config.js', '.husky/pre-commit', '.github/workflows/node.js.yml'];
	const commonFileResults = await Promise.all(commonFiles.map(async (filePath) => ({filePath, exists: await pathExists(path.join(directory, filePath))})));
	for (const {filePath, exists} of commonFileResults) {
		addCheck(`file:${filePath}`, `${filePath} exists`, exists);
	}

	const configFiles = ['oxc.config.ts', 'oxlint.config.ts', 'oxfmt.config.ts'];
	const configFileResults = await Promise.all(configFiles.map(async (filePath) => ({filePath, exists: await pathExists(path.join(directory, filePath))})));
	for (const {filePath, exists} of configFileResults) {
		addCheck(`file:${filePath}`, `${filePath} exists`, exists);
	}

	for (const script of ['typecheck', 'lint', 'format:check', 'ci', 'test']) {
		addCheck(`script:${script}`, `package.json has ${script} script`, pkg?.scripts?.[script] !== undefined);
	}

	for (const dependency of ['typescript', 'vitest', 'oxlint', 'oxfmt', 'husky', '@commitlint/cli']) {
		addCheck(`dependency:${dependency}`, `${dependency} dependency is declared`, hasAnyDependency(pkg, dependency));
	}

	const templateFileResults = await Promise.all(
		requiredFilesByTemplate[template].map(async (filePath) => ({filePath, exists: await pathExists(path.join(directory, filePath))})),
	);
	for (const {filePath, exists} of templateFileResults) {
		addCheck(`template-file:${filePath}`, `${template} file ${filePath} exists`, exists);
	}

	for (const dependency of requiredDependenciesByTemplate[template]) {
		addCheck(`template-dependency:${dependency}`, `${template} dependency ${dependency} is declared`, hasAnyDependency(pkg, dependency));
	}

	if (template === 'web-fullstack') {
		addCheck('workspaces', 'package.json has workspaces', Array.isArray(pkg?.workspaces) && pkg.workspaces.length > 0);
	}

	const requiredPassed = checks.filter((check) => check.required).every((check) => check.passed);
	const passedCount = checks.filter((check) => check.passed).length;
	const score = Math.round((passedCount / checks.length) * 100);

	return {
		directory,
		template,
		score,
		passed: requiredPassed && score >= PASS_THRESHOLD,
		checks,
	};
};

export const formatCompatibilityReport = (report: CompatibilityReport): string => {
	const failed = report.checks.filter((check) => !check.passed);
	const lines = [`Directory: ${report.directory}`, `Template: ${report.template}`, `Score: ${report.score}%`, `Status: ${report.passed ? 'PASS' : 'FAIL'}`];

	if (failed.length > 0) {
		lines.push('', 'Missing or incompatible checks:');
		for (const check of failed) {
			lines.push(`- ${check.label}${check.required ? ' (required)' : ''}`);
		}
	}

	return lines.join('\n');
};
