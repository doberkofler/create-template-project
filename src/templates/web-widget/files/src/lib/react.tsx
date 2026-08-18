import {forwardRef, useEffect, useRef, type ForwardedRef, type ReactElement} from 'react';

import {DemoWidget as NativeDemoWidget, type DemoWidgetInstance, type DemoWidgetOptions} from './widget.ts';

export type DemoWidgetReactProps = DemoWidgetOptions & {
	readonly message?: string;
};

const setForwardedRef = (ref: ForwardedRef<DemoWidgetInstance>, value: DemoWidgetInstance | null): void => {
	if (typeof ref === 'function') {
		ref(value);
		return;
	}
	if (ref !== null) {
		ref.current = value;
	}
};

export const DemoWidget = forwardRef<DemoWidgetInstance, DemoWidgetReactProps>((props, ref): ReactElement => {
	const {message} = props;
	const initialOptionsRef = useRef<DemoWidgetOptions>(props);
	const hostRef = useRef<HTMLDivElement | null>(null);
	const instanceRef = useRef<DemoWidgetInstance | null>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (host === null) {
			throw new Error('Widget host was not mounted.');
		}

		const instance = new NativeDemoWidget(host, initialOptionsRef.current);
		instanceRef.current = instance;

		return (): void => {
			instanceRef.current = null;
			instance.destroy();
		};
	}, []);

	useEffect(() => {
		setForwardedRef(ref, instanceRef.current);
		return (): void => {
			setForwardedRef(ref, null);
		};
	}, [ref]);

	useEffect(() => {
		if (message !== undefined) {
			instanceRef.current?.setMessage(message);
		}
	}, [message]);

	return <div ref={hostRef} />;
});

DemoWidget.displayName = 'DemoWidget';
