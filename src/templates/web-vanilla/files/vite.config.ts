import path from 'node:path';
import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		browser: {
			enabled: true,
			headless: true,
			screenshotDirectory: path.resolve('./temp/vitest/__screenshots__'),
			instances: [
				{
					browser: 'chromium',
					provider: playwright({
						launchOptions: {
							args: ['--disable-web-security'],
						},
					}),
				},
			],
		},
	},
});
