import {describe, it, expect} from 'vitest';
import {render} from 'vitest-browser-react';
import {page} from '@vitest/browser/context';
import {App} from './App.js';
import React from 'react';

describe('App', () => {
	it('should render in the browser', async () => {
		render(<App />);
		await expect.element(page.getByRole('main').or(page.getByText(/Dashboard/i))).toBeDefined();
	});
});
