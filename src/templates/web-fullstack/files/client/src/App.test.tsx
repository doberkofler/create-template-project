import {describe, it, expect} from 'vitest';
import {render} from 'vitest-browser-react';
import {page} from 'vitest/browser';
import {App} from './App.js';

describe('App', () => {
	it('should render in the browser', async () => {
		await render(<App />);
		await expect.element(page.getByRole('heading', {name: /Login/i}).or(page.getByRole('heading', {name: /Dashboard/i}))).toBeVisible();
	});
});
