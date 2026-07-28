import {describe, expect, it} from 'vitest';
import {createWidget} from './widget.ts';

describe('DemoWidget', () => {
	it('renders and handles actions', async () => {
		const host = document.createElement('div');
		const actions: number[] = [];
		const widget = createWidget(host, {
			title: 'Test Widget',
			onAction: (count) => {
				actions.push(count);
			},
		});

		expect(host.querySelector('.widget__title')?.textContent).toBe('Test Widget');
		await widget.increment();

		expect(host.querySelector('.widget__message')?.textContent).toBe('Clicked 1 time.');
		expect(actions).toStrictEqual([1]);
	});

	it('throws after destroy', () => {
		const host = document.createElement('div');
		const widget = createWidget(host);

		widget.destroy();

		expect(() => {
			widget.setMessage('late update');
		}).toThrow('Widget has been destroyed.');
		expect(host.children).toHaveLength(0);
	});
});
