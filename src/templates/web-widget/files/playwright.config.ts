import {defineConfig, devices} from '@playwright/test';
import {env} from 'node:process';

const isCi = env.CI !== undefined;

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.e2e-test.ts',
	fullyParallel: true,
	forbidOnly: isCi,
	retries: isCi ? 2 : 0,
	workers: isCi ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: 'http://localhost:4173',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: {...devices['Desktop Chrome']},
		},
	],
	webServer: {
		command: '{{packageManager}} run build && {{packageManager}} run start',
		url: 'http://localhost:4173',
		reuseExistingServer: !isCi,
	},
});
