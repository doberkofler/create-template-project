/** @type {import('stylelint').Config} */
const config = {
	extends: ['stylelint-config-standard'],
	rules: {
		'alpha-value-notation': 'number',
		'color-function-notation': 'legacy',
		'declaration-empty-line-before': null,
		'font-family-name-quotes': null,
		'media-feature-range-notation': 'context',
		'number-max-precision': 4,
		'rule-empty-line-before': null,
		'selector-not-notation': 'simple',
	},
};

export default config;
