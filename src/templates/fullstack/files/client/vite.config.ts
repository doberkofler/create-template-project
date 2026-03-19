import path from 'node:path';
import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {playwright} from '@vitest/browser-playwright';

export default defineConfig({
	plugins: [react()],
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
