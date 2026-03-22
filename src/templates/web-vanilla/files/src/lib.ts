export const createHeading = (text: string): HTMLHeadingElement => {
	const h1 = document.createElement('h1');
	h1.textContent = text;
	return h1;
};

export const formatMessage = (name: string): string => {
	return `Hello, ${name}!`;
};
