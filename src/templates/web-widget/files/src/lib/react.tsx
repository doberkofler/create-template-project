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
	const {message, ...mountOptions} = props;
	const hostRef = useRef<HTMLDivElement | null>(null);
	const instanceRef = useRef<DemoWidgetInstance | null>(null);

	useEffect(() => {
		const host = hostRef.current;
		if (host === null) {
			return (): void => {
				setForwardedRef(ref, null);
			};
		}

		const instance = new NativeDemoWidget(host, {...mountOptions, ...(message === undefined ? {} : {message})});
		instanceRef.current = instance;
		setForwardedRef(ref, instance);

		return (): void => {
			instanceRef.current = null;
			setForwardedRef(ref, null);
			instance.destroy();
		};
		// Mount-only options are intentionally captured once. Mutable props are synced below through native setters.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (message !== undefined) {
			instanceRef.current?.setMessage(message);
		}
	}, [message]);

	return <div ref={hostRef} />;
});

DemoWidget.displayName = 'DemoWidget';
