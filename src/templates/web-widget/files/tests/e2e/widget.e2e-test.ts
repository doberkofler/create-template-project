import {expect, test} from '@playwright/test';

test.describe('widget demo', () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders the widget and increments from the demo', async ({page}) => {
		await expect(page.locator('.widget')).toBeVisible();
		await expect(page.locator('.widget__title')).toHaveText('{{projectName}}');

		await page.locator('.widget__button').click();

		await expect(page.locator('.widget__message')).toHaveText('Clicked 1 time.');
	});
});
