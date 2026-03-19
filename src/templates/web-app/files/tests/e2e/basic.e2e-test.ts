import {test, expect} from '@playwright/test';

test('has title', async ({page}) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/{{projectName}}/);
});

test('api is reachable', async ({page}) => {
	const response = await page.request.get('/api/hello');
	expect(response.ok()).toBeTruthy();
	const data = await response.json();
	expect(data.message).toBe('Hello from Express!');
});
