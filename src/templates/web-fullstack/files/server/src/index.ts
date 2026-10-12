import express from 'express';
import cors from 'cors';
import * as trpcExpress from '@trpc/server/adapters/express';
import {appRouter} from './routers/_app.js';
import {createContext} from './context.js';
import path from 'node:path';

const rootDir = import.meta.dirname;
const app = express();
// Destructured so the port keeps working with `noPropertyAccessFromIndexSignature`.
const {PORT} = process.env;
const port = Number(PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.use(
	'/trpc',
	trpcExpress.createExpressMiddleware({
		router: appRouter,
		createContext,
	}),
);

app.use(express.static(path.join(rootDir, '../../client/dist')));

app.get('/{*path}', (_req, res) => {
	res.sendFile(path.join(rootDir, '../../client/dist/index.html'));
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
