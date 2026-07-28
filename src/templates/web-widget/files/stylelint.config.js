import baseConfig from './stylelint.base.config.js';

const widgetCssPrefix = 'widget';

/** @type {import('stylelint').Config} */
const config = {
	...baseConfig,
	rules: {
		...baseConfig.rules,
		'custom-property-pattern': `^(${widgetCssPrefix}|demo)-[a-z][a-z0-9-]*$`,
		'selector-class-pattern': [`^(${widgetCssPrefix}(?:[a-zA-Z0-9_-]+)?|demo-[a-zA-Z0-9_-]+)$`, {resolveNestedSelectors: true}],
	},
};

export default config;
