import {CreateExpressContextOptions} from '@trpc/server/adapters/express';

interface User {
	id: string;
	name: string;
	email: string;
}

export const createContext = ({req}: CreateExpressContextOptions) => {
	const authHeader = req.headers.authorization;
	let user: User | null = null;

	if (authHeader?.startsWith('Bearer ')) {
		const token = authHeader.split(' ')[1];
		// Mock token verification
		if (token === 'mock-token') {
			user = {id: '1', name: 'Demo User', email: 'demo@example.com'};
		}
	}

	return {user};
};

export type Context = Awaited<ReturnType<typeof createContext>>;
