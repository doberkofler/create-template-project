#!/usr/bin/env node
import {parseArgs} from './cli.js';
import {generateProject} from './generators/project.js';
import {intro, outro, cancel} from '@clack/prompts';
import debugLib from 'debug';

if (process.argv.includes('--debug')) {
	process.env['DEBUG'] = 'create-template-project:*';
	debugLib.enable('create-template-project:*');
}

const debug = debugLib('create-template-project:main');

export const main = async () => {
	try {
		debug('Starting CLI execution');
		debug('Parsing arguments');
		const options = await parseArgs();
		if (!options) {
			return;
		}
		const isSilent = !!options.silent;

		if (!isSilent) {
			intro('create-template-project');
		}

		debug('Arguments parsed: %O', options);
		debug('Generating project');
		await generateProject(options);
		debug('Project generation complete');

		if (!isSilent) {
			outro('Done!');
		}
	} catch (error: any) {
		debug('Execution failed: %O', error);
		if (error.code === 'PROCESS_EXIT_0' || error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
			process.exit(0);
		}
		if (error.code === 'PROCESS_EXIT_1') {
			process.exit(1);
		}
		cancel(error?.message || String(error));
		process.exit(1);
	}
};

// Only run main if this file is executed directly
if (import.meta.url.endsWith('src/index.ts') || import.meta.url.endsWith('dist/index.mjs')) {
	await main();
}
