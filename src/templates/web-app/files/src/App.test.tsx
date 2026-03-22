import {expect, test} from 'vitest';
import {render} from 'vitest-browser-react';
import {page} from 'vitest/browser';
import {App} from './App.js';

test('renders hello message in the browser', async () => {
	await render(<App />);
	await expect.element(page.getByText(/Hello from React!/i)).toBeVisible();
});
