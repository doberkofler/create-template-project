import {createRoot} from 'react-dom/client';
import {App} from './App.js';

const container = document.querySelector<HTMLElement>('#app');
if (container) {
	const root = createRoot(container);
	root.render(<App />);
}
