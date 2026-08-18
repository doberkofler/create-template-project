import {act, createRef, type ComponentRef} from 'react';
import {createRoot} from 'react-dom/client';
import {describe, expect, it, vi} from 'vitest';

import {DemoWidget} from './react.tsx';

describe('DemoWidget React wrapper', () => {
	it('preserves mount options, updates mutable props, forwards refs, and cleans up', () => {
		const host = document.createElement('div');
		const firstRef = createRef<ComponentRef<typeof DemoWidget>>();
		const secondRef = vi.fn<(value: ComponentRef<typeof DemoWidget> | null) => void>();
		const root = createRoot(host);

		act(() => {
			root.render(<DemoWidget ref={firstRef} title="Initial title" message="Initial message" />);
		});

		const instance = firstRef.current;
		expect(instance).not.toBeNull();
		expect(host.querySelector('.widget__title')?.textContent).toBe('Initial title');
		expect(host.querySelector('.widget__message')?.textContent).toBe('Initial message');

		act(() => {
			root.render(<DemoWidget ref={secondRef} title="Ignored title" message="Updated message" />);
		});

		expect(firstRef.current).toBeNull();
		expect(secondRef).toHaveBeenLastCalledWith(instance);
		expect(host.querySelector('.widget__title')?.textContent).toBe('Initial title');
		expect(host.querySelector('.widget__message')?.textContent).toBe('Updated message');

		act(() => {
			root.unmount();
		});

		expect(secondRef).toHaveBeenLastCalledWith(null);
		expect(host.children).toHaveLength(0);
	});
});
