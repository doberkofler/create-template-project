import {defineConfig} from 'oxlint';
import {configs as regexpConfigs} from 'eslint-plugin-regexp';

const commonIgnore = [
	'**/.*',
	'node_modules/**',
	'dist/**',
	'build/**',
	'coverage/**',
	'temp/**',
	'public/**',
	'**/*.md',
	'**/*.yaml',
	'src/templates/**/files/**',
];

/** Filter out core ESLint rules bundled into eslint-plugin-regexp recommended config */
const regexpPluginRules = Object.fromEntries(Object.entries(regexpConfigs.recommended.rules).filter(([key]) => key.startsWith('regexp/')));

export const linter = defineConfig({
	options: {
		typeAware: true,
		typeCheck: true,
	},
	plugins: ['unicorn', 'typescript', 'oxc', 'import', 'react', 'jsdoc', 'promise', 'vitest'],
	jsPlugins: ['eslint-plugin-regexp'],
	categories: {
		correctness: 'error',
		nursery: 'error',
		pedantic: 'error',
		perf: 'error',
		restriction: 'error',
		style: 'error',
		suspicious: 'error',
	},
	rules: {
		...regexpPluginRules,
		'eslint/capitalized-comments': 'off', // TODO: consider enabling
		'eslint/complexity': 'off', // TODO: consider enabling
		'eslint/curly': ['error', 'all'],
		'eslint/id-length': 'off',
		'eslint/init-declarations': 'off', // TODO: consider enabling
		'eslint/max-depth': 'off', // TODO: consider enabling
		'eslint/max-lines': 'off', // TODO: consider enabling
		'eslint/max-lines-per-function': 'off', // TODO: consider enabling
		'eslint/max-params': 'off', // TODO: consider enabling
		'eslint/max-statements': 'off', // TODO: consider enabling
		'eslint/no-await-in-loop': 'warn',
		'eslint/no-console': 'off',
		'eslint/no-continue': 'off',
		'eslint/no-inline-comments': 'off',
		'eslint/no-magic-numbers': 'off',
		'eslint/no-negated-condition': 'off', // TODO: consider enabling
		'eslint/no-nested-ternary': 'off',
		'eslint/no-warning-comments': 'off',
		'eslint/no-undefined': 'off', // TODO: consider enabling
		'eslint/no-plusplus': 'off',
		'eslint/one-var': 'off',
		'eslint/sort-imports': 'off',
		'eslint/sort-keys': 'off',
		'eslint/no-ternary': 'off',
		'eslint/no-void': ['error', {allowAsStatement: true}],
		'typescript/consistent-type-definitions': ['error', 'type'],
		'typescript/dot-notation': ['error', {allowPattern: '^[a-zA-Z]+(_[a-zA-Z]+)+$'}],
		'typescript/no-import-type-side-effects': 'off',
		'typescript/no-unused-vars': [
			'error',
			{
				caughtErrors: 'none',
				argsIgnorePattern: '^_',
			},
		],
		'typescript/prefer-readonly-parameter-types': 'off',
		'import/consistent-type-specifier-style': ['error', 'prefer-inline'],
		'import/exports-last': 'off',
		'import/group-exports': 'off',
		'import/max-dependencies': 'off',
		'import/no-named-export': 'off',
		'import/no-namespace': 'off', // TODO: consider enabling
		'import/no-nodejs-modules': 'off',
		'import/prefer-default-export': 'off',
		'import/no-default-export': 'off',
		'jsdoc/require-param': 'error',
		'jsdoc/require-param-type': 'off',
		'jsdoc/require-returns': 'warn',
		'jsdoc/require-returns-type': 'off',
		'oxc/no-async-await': 'off',
		'oxc/no-map-spread': 'off', // TODO: consider enabling
		'oxc/no-optional-chaining': 'off',
		'oxc/no-rest-spread-properties': 'off',
		'unicorn/escape-case': 'off',
		'unicorn/filename-case': 'off', // TODO: consider enabling
		'unicorn/no-array-reduce': 'off', // TODO: consider enabling
		'unicorn/no-array-sort': 'off', // TODO: consider enabling
		'unicorn/no-hex-escape': 'off',
		'unicorn/no-immediate-mutation': 'off',
		'unicorn/no-negated-condition': 'off',
		'unicorn/no-nested-ternary': 'off',
		'unicorn/no-null': 'off', // TODO: consider enabling
		'unicorn/no-process-exit': 'off', // TODO: consider enabling
		'unicorn/no-typeof-undefined': 'off', // TODO: consider enabling
		'unicorn/prefer-module': 'off', // TODO: consider enabling
		'unicorn/prefer-number-coercion': 'off', // TODO: consider enabling
		'vitest/max-expects': 'off',
		'vitest/no-conditional-in-test': 'off',
		'vitest/no-hooks': 'off',
		'vitest/no-importing-vitest-globals': 'off',
		'vitest/prefer-describe-function-title': 'off',
		'vitest/prefer-expect-assertions': 'off',
		'vitest/prefer-lowercase-title': 'off',
		'vitest/prefer-to-be-truthy': 'off', // FIXME: Conflict Detected: prefer-strict-boolean-matchers enforces toBe(true), but prefer-to-be-truthy enforces toBeTruthy().
		'vitest/require-hook': 'off',
		'vitest/require-test-timeout': 'off',
	},
	overrides: [
		{
			files: ['tests/e2e/**/*.e2e-test.ts', '**/*.e2e-test.ts'],
			rules: {
				'vitest/prefer-importing-vitest-globals': 'off',
			},
		},
	],
	settings: {
		'jsx-a11y': {
			polymorphicPropName: undefined,
			components: {},
			attributes: {},
		},
		next: {
			rootDir: [],
		},
		react: {
			formComponents: [],
			linkComponents: [],
			version: undefined,
		},
		jsdoc: {
			ignorePrivate: false,
			ignoreInternal: false,
			ignoreReplacesDocs: true,
			overrideReplacesDocs: true,
			augmentsExtendsReplacesDocs: false,
			implementsReplacesDocs: false,
			exemptDestructuredRootsFromChecks: false,
			tagNamePreference: {},
		},
		vitest: {
			typecheck: false,
		},
	},
	env: {
		builtin: true,
		node: true,
	},
	globals: {},
	ignorePatterns: commonIgnore,
});

export const formatter = {
	printWidth: 160,
	embeddedLanguageFormatting: 'off',
	useTabs: true,
	singleQuote: true,
	bracketSpacing: false,
	ignorePatterns: commonIgnore,
	overrides: [
		{
			files: ['src/**/*.{scss,css}'],
			options: {
				singleQuote: false,
			},
		},
	],
};
