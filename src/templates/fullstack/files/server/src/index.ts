import express from 'express';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3001;

app.use(express.static(path.join(__dirname, '../../client/dist')));

app.get('/api/status', (req, res) => {
	res.json({status: 'ok', timestamp: new Date()});
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
