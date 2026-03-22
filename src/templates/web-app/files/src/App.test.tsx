import {expect, test} from 'vitest';
import {render} from 'vitest-browser-react';
import {page} from '@vitest/browser/context';
import {App} from './App.js';
import React from 'react';

test('renders hello message in the browser', async () => {
	render(<App />);
	await expect.element(page.getByText(/Hello from React!/i)).toBeVisible();
});
