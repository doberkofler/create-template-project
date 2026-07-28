import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {cwd} from 'node:process';

import {chromium} from 'playwright';
import {createServer} from 'vite';

const PORT = 4199;

try {
	const server = await createServer({
		root: cwd(),
		server: {port: PORT, strictPort: true},
	});
	await server.listen();

	try {
		const browser = await chromium.launch();
		const page = await browser.newPage({viewport: {width: 1280, height: 800}});

		await page.goto(`http://localhost:${PORT}`);
		await page.waitForSelector('.widget');
		const outputPath = path.resolve(cwd(), 'docs/images/widget-demo.png');
		await mkdir(path.dirname(outputPath), {recursive: true});
		await page.locator('.demo-hero').screenshot({path: outputPath, type: 'png'});

		console.log(`Screenshot saved to ${outputPath}`);
		await browser.close();
	} finally {
		await server.close();
	}
} catch (error) {
	console.error(String(error));
	throw error;
}
