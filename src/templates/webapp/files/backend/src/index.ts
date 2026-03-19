import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../client')));

app.get('/api/hello', (req, res) => {
	res.json({message: 'Hello from Express!'});
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
