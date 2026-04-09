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
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: {...devices['Desktop Chrome']},
		},
	],
	webServer: [
		{
			command: 'npm run dev --workspace=server',
			port: 3000,
			reuseExistingServer: !isCi,
		},
		{
			command: 'npm run dev --workspace=client',
			port: 5173,
			reuseExistingServer: !isCi,
		},
	],
});
