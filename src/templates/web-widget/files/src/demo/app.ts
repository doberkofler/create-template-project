import {createWidget} from '{{projectName}}';

const init = (): void => {
	const host = document.querySelector<HTMLElement>('#widget-host');
	if (host === null) {
		throw new Error('Missing #widget-host element');
	}

	createWidget(host, {
		title: '{{projectName}}',
		message: 'Built with TypeScript, tsdown, Vite, TypeDoc, and Playwright.',
		onAction: (count) => {
			console.info(`Widget action ${count}`);
		},
	});
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
