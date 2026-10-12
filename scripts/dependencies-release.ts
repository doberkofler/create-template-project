/// <reference types="node" />
// Dispatches the `update-dependencies` GitHub Actions workflow, waits for it to
// finish, and streams its logs to this terminal -- one command instead of the
// three `gh` invocations it replaces.
//
// The workflow is NOT a dry run. It updates dependencies to the newest versions
// satisfying the configured minimum release age, runs the full CI suite, commits
// the changes, creates a patch release, and publishes to npm. Publishing relies
// on npm trusted publishing (OIDC); see CONTRIBUTING.md.

import {spawnSync, type SpawnSyncOptionsWithStringEncoding, type SpawnSyncReturns} from 'node:child_process';
import process from 'node:process';

const WORKFLOW_FILE = 'update-dependencies.yml';
const RUN_ID_PATTERN = /^\d+$/u;

// This repository's workflow declares a `min-release-age` input, so it is always
// passed explicitly. Projects whose workflow declares no inputs pass nothing.
const WORKFLOW_INPUTS: readonly string[] = ['--raw-field', 'min-release-age=1'];

// Single choke point for `gh` so a missing or unauthenticated binary produces an
// actionable error instead of an opaque spawn failure.
const spawnGh = (args: readonly string[], stdio: 'inherit' | 'pipe' = 'pipe'): SpawnSyncReturns<string> => {
	const options: SpawnSyncOptionsWithStringEncoding = {encoding: 'utf8', stdio};
	const result = spawnSync('gh', args, options);
	if (result.error !== undefined) {
		throw new Error(`Failed to run "gh ${args.join(' ')}": ${result.error.message}. Is the GitHub CLI installed and authenticated?`, {cause: result.error});
	}

	return result;
};

const dispatchWorkflow = (): string | null => {
	// `gh workflow run` only reports the run URL once GitHub has registered the
	// run, so the caller falls back to the most recent run when no id is parsed.
	const result = spawnGh(['workflow', 'run', WORKFLOW_FILE, ...WORKFLOW_INPUTS]);
	if (result.status !== 0) {
		process.stderr.write(result.stderr);
		throw new Error(`Failed to dispatch ${WORKFLOW_FILE}.`);
	}

	const runId = result.stdout.trim().split('/').at(-1);
	return runId !== undefined && RUN_ID_PATTERN.test(runId) ? runId : null;
};

const findLatestRunId = (): string => {
	const result = spawnGh(['run', 'list', '--workflow', WORKFLOW_FILE, '--limit', '1', '--json', 'databaseId', '--jq', '.[0].databaseId']);
	if (result.status !== 0) {
		process.stderr.write(result.stderr);
		throw new Error(`Failed to find the latest ${WORKFLOW_FILE} run.`);
	}

	const runId = result.stdout.trim();
	if (runId === '' || runId === 'null') {
		throw new Error(`No run of ${WORKFLOW_FILE} found. Open the repository's Actions tab to inspect the dispatch.`);
	}

	return runId;
};

const watchRun = (runId: string): void => {
	const result = spawnGh(['run', 'watch', runId, '--exit-status'], 'inherit');
	if (result.status !== 0) {
		throw new Error(`Run ${runId} did not succeed. Inspect it with: gh run view ${runId} --log-failed`);
	}
};

const main = (): void => {
	console.log(`Dispatching ${WORKFLOW_FILE}...`);
	const runId = dispatchWorkflow() ?? findLatestRunId();

	console.log(`Watching run ${runId}. Detaching with Ctrl-C does not cancel the run.`);
	watchRun(runId);

	console.log(`Run ${runId} finished successfully. Full logs:`);
	spawnGh(['run', 'view', runId, '--log'], 'inherit');
};

try {
	main();
} catch (error: unknown) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
