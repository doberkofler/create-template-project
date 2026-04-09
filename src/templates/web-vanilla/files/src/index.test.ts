import {expect, test} from 'vitest';
import {page} from 'vitest/browser';
import {formatMessage, createHeading} from './lib.js';

test('formatMessage returns correct string', () => {
	expect(formatMessage('World')).toBe('Hello, World!');
});

test('createHeading renders in the browser', async () => {
	document.body.append(createHeading('Browser Test'));
	await expect.element(page.getByRole('heading', {name: 'Browser Test'})).toBeVisible();
});
