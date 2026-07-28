import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {validateProjectCompatibility} from './project-compatibility.js';

const createProject = async (files: readonly string[], devDependencies: Record<string, string> = {}): Promise<string> => {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'project-compatibility-'));
	await fs.writeFile(
		path.join(directory, 'package.json'),
		JSON.stringify(
			{
				name: 'compatible-project',
				type: 'module',
				scripts: {
					typecheck: 'tsc --noEmit',
					lint: 'oxlint',
					'format:check': 'oxfmt --check',
					ci: 'pnpm run typecheck',
					test: 'vitest run',
				},
				devDependencies: {
					'@commitlint/cli': '1.0.0',
					husky: '1.0.0',
					oxfmt: '1.0.0',
					oxlint: '1.0.0',
					playwright: '1.0.0',
					stylelint: '1.0.0',
					tsdown: '1.0.0',
					typedoc: '1.0.0',
					typescript: '1.0.0',
					vite: '1.0.0',
					vitest: '1.0.0',
					...devDependencies,
				},
			},
			null,
			'\t',
		),
	);

	await Promise.all(
		files.map(async (filePath) => {
			const absolutePath = path.join(directory, filePath);
			await fs.mkdir(path.dirname(absolutePath), {recursive: true});
			await fs.writeFile(absolutePath, '');
		}),
	);

	return directory;
};

const commonFiles = ['tsconfig.json', 'vitest.config.ts', 'commitlint.config.js', '.husky/pre-commit', 'oxc.config.ts', 'oxlint.config.ts', 'oxfmt.config.ts'];

describe('project compatibility', () => {
	it('accepts canonical ci.yml workflow', async () => {
		const directory = await createProject([...commonFiles, '.github/workflows/ci.yml', 'src/index.ts', 'src/index.test.ts', 'vite.config.ts']);

		const report = await validateProjectCompatibility(directory, 'cli');

		expect(report.checks.find((check) => check.id === 'file:.github/workflows/ci.yml')?.passed).toBe(true);
	});

	it('accepts legacy node.js.yml workflow for adoption compatibility', async () => {
		const directory = await createProject([...commonFiles, '.github/workflows/node.js.yml', 'src/index.ts', 'src/index.test.ts', 'vite.config.ts']);

		const report = await validateProjectCompatibility(directory, 'cli');

		expect(report.checks.find((check) => check.id === 'file:.github/workflows/ci.yml')?.passed).toBe(true);
	});

	it('accepts project-specific web-widget implementation and stylesheet filenames', async () => {
		const directory = await createProject([
			...commonFiles,
			'.github/workflows/ci.yml',
			'index.html',
			'src/lib/index.ts',
			'src/lib/scoped-search-bar.ts',
			'src/styles/scoped-search-bar.css',
			'tsdown.config.ts',
			'typedoc.json',
			'vite.config.ts',
			'playwright.config.ts',
		]);

		const report = await validateProjectCompatibility(directory, 'web-widget');

		expect(report.passed).toBe(true);
		expect(report.checks.find((check) => check.id === 'web-widget:implementation')?.passed).toBe(true);
		expect(report.checks.find((check) => check.id === 'web-widget:stylesheet')?.passed).toBe(true);
	});
});
