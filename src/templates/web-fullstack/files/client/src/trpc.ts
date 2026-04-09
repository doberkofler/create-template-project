/* eslint-disable import/no-relative-parent-imports */
import {createTRPCReact} from '@trpc/react-query';
import {type AppRouter} from '../../server/src/routers/_app.js';

export const trpc = createTRPCReact<AppRouter>();
