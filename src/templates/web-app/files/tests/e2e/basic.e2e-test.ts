import {test, expect} from '@playwright/test';

test('has title', async ({page}) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/{{projectName}}/u);
});

test('app heading is visible', async ({page}) => {
	await page.goto('/');
	await expect(page.getByRole('heading', {name: 'Hello from React!'})).toBeVisible();
});
