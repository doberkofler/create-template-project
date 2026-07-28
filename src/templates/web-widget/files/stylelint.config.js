/** @type {import('stylelint').Config} */
const config = {
	extends: ['stylelint-config-standard'],
	rules: {
		'alpha-value-notation': 'number',
		'color-function-notation': 'legacy',
		'custom-property-pattern': '^(widget|demo)-[a-z][a-z0-9-]*$',
		'declaration-empty-line-before': null,
		'font-family-name-quotes': null,
		'media-feature-range-notation': 'context',
		'number-max-precision': 4,
		'rule-empty-line-before': null,
		'selector-class-pattern': ['^(widget(?:[a-zA-Z0-9_-]+)?|demo-[a-zA-Z0-9_-]+)$', {resolveNestedSelectors: true}],
		'selector-not-notation': 'simple',
	},
};

export default config;
