import {test, expect} from '@playwright/test';

test('has title', async ({page}) => {
	await page.goto('/');
	await expect(page).toHaveTitle(/{{projectName}}/u);
});

test('can login', async ({page}) => {
	await page.goto('/login');
	await page.fill('input[type="email"]', 'demo@example.com');
	await page.fill('input[type="password"]', 'password');
	await page.click('button[type="submit"]');
	await expect(page).toHaveURL('/dashboard');
});
