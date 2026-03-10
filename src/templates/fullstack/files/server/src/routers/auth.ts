import {z} from 'zod';
import {publicProcedure, protectedProcedure, router} from '../trpc.js';
import {TRPCError} from '@trpc/server';

export const authRouter = router({
	login: publicProcedure
		.input(
			z.object({
				email: z.string().email(),
				password: z.string().min(6),
			}),
		)
		.mutation(async ({input}) => {
			// Mock authentication logic
			if (input.email === 'demo@example.com' && input.password === 'password') {
				return {
					token: 'mock-token',
					user: {id: '1', name: 'Demo User', email: 'demo@example.com'},
				};
			}
			throw new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'Invalid email or password',
			});
		}),
	me: protectedProcedure.query(({ctx}) => {
		return ctx.user;
	}),
});
