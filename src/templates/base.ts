import {TemplateDefinition} from '../types.js';

export const getBaseTemplate = (projectName: string): TemplateDefinition => ({
	name: 'base',
	dependencies: {
		debug: '^4.4.3',
	},
	devDependencies: {
		'@commitlint/cli': '^20.4.2',
		'@commitlint/config-conventional': '^20.4.2',
		'@types/debug': '^4.1.12',
		'@types/node': '^25.3.0',
		'@vitest/coverage-v8': '^4.0.18',
		'conventional-changelog-cli': '^5.0.0',
		husky: '^9.1.7',
		oxlint: '^1.50.0',
		'oxlint-tsgolint': '^0.15.0',
		prettier: '^3.8.1',
		typescript: '^5.9.3',
		vitest: '^4.0.18',
	},
	scripts: {
		lint: 'tsc && oxlint --type-aware --type-check && npm run prettier',
		prettier: 'prettier --check .',
		'prettier-write': 'prettier --write .',
		test: 'vitest run --coverage',
		ci: 'npm run lint && npm run build && npm run test',
		prepare: 'husky',
	},
	files: [
		{
			path: '.gitignore',
			content: 'node_modules\ndist\ncoverage\n.DS_Store\n.env\n',
		},
		{
			path: 'commitlint.config.js',
			content: "export default { extends: ['@commitlint/config-conventional'] };\n",
		},
		{
			path: '.prettierrc.json',
			content: JSON.stringify({useTabs: true, singleQuote: true, trailingComma: 'all', printWidth: 100}, null, '\t'),
		},
		{
			path: 'vitest.config.ts',
			content: "import { defineConfig } from 'vitest/config';\n\nexport default defineConfig({ test: { coverage: { provider: 'v8' } } });\n",
		},
		{
			path: 'README.md',
			content: `# ${projectName}

[![NPM Version](https://img.shields.io/npm/v/${projectName}.svg)](https://www.npmjs.com/package/${projectName})
[![NPM Downloads](https://img.shields.io/npm/dm/${projectName}.svg)](https://www.npmjs.com/package/${projectName})
[![Node.js CI](https://github.com/doberkofler/${projectName}/actions/workflows/node.js.yml/badge.svg)](https://github.com/doberkofler/${projectName}/actions/workflows/node.js.yml)
[![Coverage Status](https://coveralls.io/repos/github/doberkofler/${projectName}/badge.svg?branch=master)](https://coveralls.io/github/doberkofler/${projectName}/branch=master)

Generated with create-template-project.
`,
		},
		{
			path: 'CONTRIBUTING.md',
			content: '# Contributing\n\nPlease follow conventional commits.\n',
		},
		{
			path: 'AGENTS.md',
			content: `# Agent Guidelines: ${projectName}\n\nBuild/Lint/Test:\n- \`npm run ci\`\n- \`npx vitest <file>\`\n`,
		},
		{
			path: '.github/workflows/node.js.yml',
			content: `name: Node.js CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Use Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '22.x'
        cache: 'npm'
    - run: npm ci
    - run: npm run ci
`,
		},
	],
});
