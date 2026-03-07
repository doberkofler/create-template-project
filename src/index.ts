#!/usr/bin/env node
import {parseArgs} from './cli.js';
import {generateProject} from './generators/project.js';

const main = async () => {
	try {
		const options = await parseArgs();
		await generateProject(options);
	} catch (error) {
		console.error('Error scaffolding project:', error instanceof Error ? error.message : error);
		process.exit(1);
	}
};

await main();
