#!/usr/bin/env node
import {parseArgs} from './cli.js';
import {generateProject} from './generators/project.js';
import {intro, outro, cancel} from '@clack/prompts';
import debugLib from 'debug';

if (process.argv.includes('--debug')) {
	process.env.DEBUG = 'create-template-project:*';
	debugLib.enable('create-template-project:*');
}

const debug = debugLib('create-template-project:main');

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getErrorCode = (error: unknown): string | undefined => {
	if (!isRecord(error)) {
		return undefined;
	}

	const {code} = error;
	return typeof code === 'string' ? code : undefined;
};

const getErrorMessage = (error: unknown): string => {
	if (isRecord(error)) {
		const {message} = error;
		if (typeof message === 'string') {
			return message;
		}
	}

	return String(error);
};

export const main = async (): Promise<void> => {
	try {
		debug('Starting CLI execution');
		debug('Parsing arguments');
		const options = await parseArgs();
		const isProgress = options.progress;

		if (isProgress) {
			intro('create-template-project');
		}

		debug('Arguments parsed: %O', options);
		debug('Generating project');
		await generateProject(options);
		debug('Project generation complete');

		if (isProgress) {
			outro('Done!');
		}
	} catch (error: unknown) {
		debug('Execution failed: %O', error);
		const errorCode = getErrorCode(error);
		if (errorCode === 'PROCESS_EXIT_0' || errorCode === 'commander.helpDisplayed' || errorCode === 'commander.version') {
			process.exit(0);
		}
		if (errorCode === 'PROCESS_EXIT_1') {
			process.exit(1);
		}
		cancel(getErrorMessage(error));
		process.exit(1);
	}
};

// Only run main if this file is executed directly
if (process.env.NODE_ENV !== 'test' && (import.meta.url.endsWith('src/index.ts') || import.meta.url.endsWith('dist/index.js'))) {
	await main();
}
