import {describe, it, expect} from 'vitest';
import {appRouter} from './routers/_app.js';
import {createCallerFactory} from './trpc.js';

const createCaller = createCallerFactory(appRouter);

describe('auth router', () => {
	it('should login successfully with valid credentials', async () => {
		const caller = createCaller({user: null});
		const result = await caller.auth.login({
			email: 'demo@example.com',
			password: 'password',
		});

		expect(result).toHaveProperty('token');
		expect(result.user.email).toBe('demo@example.com');
	});

	it('should throw UNAUTHORIZED for invalid credentials', async () => {
		const caller = createCaller({user: null});
		await expect(
			caller.auth.login({
				email: 'wrong@example.com',
				password: 'password123',
			}),
		).rejects.toThrow(/Invalid email or password/);
	});
});
