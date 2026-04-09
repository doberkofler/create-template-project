/* eslint-disable oxc/no-optional-chaining */
/* eslint-disable typescript/strict-boolean-expressions */
import {type CreateExpressContextOptions} from '@trpc/server/adapters/express';

type User = {
	id: string;
	name: string;
	email: string;
};

export const createContext = ({req}: CreateExpressContextOptions): {user: User | null} => {
	const authHeader = req.headers.authorization;
	let user: User | null = null;

	if (authHeader?.startsWith('Bearer ')) {
		const [, token] = authHeader.split(' ');
		// Mock token verification
		if (token === 'mock-token') {
			user = {id: '1', name: 'Demo User', email: 'demo@example.com'};
		}
	}

	return {user};
};

export type Context = Awaited<ReturnType<typeof createContext>>;
