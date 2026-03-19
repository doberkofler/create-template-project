import {test, expect} from '@playwright/test';

test('has title', async ({page}) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/{{projectName}}/);
});

test('header is visible', async ({page}) => {
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
});
