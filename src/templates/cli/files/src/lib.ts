export const greet = (name: string): string => `Hello, ${name}! Welcome to your new CLI.`;

export const calculateProgress = (current: number, total: number): number => {
	if (total === 0) {
		return 0;
	}
	return Math.round((current / total) * 100);
};
