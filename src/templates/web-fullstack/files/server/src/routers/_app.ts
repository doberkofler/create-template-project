/* eslint-disable import/no-relative-parent-imports */
import {router} from '../trpc.js';
import {authRouter} from './auth.js';

export const appRouter = router({
	auth: authRouter,
});

export type AppRouter = typeof appRouter;
