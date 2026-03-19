import {test, expect} from '@playwright/test';

test('has title', async ({page}) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/{{projectName}}/);
});

test('can login', async ({page}) => {
	await page.goto('/login');
	await page.fill('input[name="username"]', 'admin');
	await page.fill('input[name="password"]', 'password');
	await page.click('button[type="submit"]');
	await expect(page).toHaveURL('/');
});
