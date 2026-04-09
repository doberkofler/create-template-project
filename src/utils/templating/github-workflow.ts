import {type ContentProcessor} from './types.js';

const WORKFLOW_PNPM_SETUP = `      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
          run_install: false`;

const WORKFLOW_PLAYWRIGHT_SETUP = `      - name: Install Playwright Browsers & Deps
        run: npx playwright install --with-deps chromium`;

export const githubWorkflowProcessor: ContentProcessor = (content, {filePath, opts}) => {
	if (!filePath.includes('.github/workflows/node.js.yml')) {
		return content;
	}

	const {template, packageManager: pm} = opts;

	let installCommand = 'npm ci';
	let pmSetup = '';
	if (pm === 'pnpm') {
		installCommand = 'pnpm install --frozen-lockfile';
		pmSetup = WORKFLOW_PNPM_SETUP;
	} else if (pm === 'yarn') {
		installCommand = 'yarn install --frozen-lockfile';
	}

	let playwrightSetup = '';
	if (template === 'web-fullstack' || template === 'web-app' || template === 'web-vanilla') {
		playwrightSetup = WORKFLOW_PLAYWRIGHT_SETUP;
	}

	let processed = content
		.replaceAll('{{installCommand}}', installCommand)
		.replaceAll('# [PM_SETUP]', pmSetup)
		.replaceAll('# [PLAYWRIGHT_SETUP]', playwrightSetup);

	// Clean up empty lines from empty placeholders
	processed = processed.replace(/^\s*# \[PM_SETUP\]\s*\n/m, '');
	processed = processed.replace(/^\s*# \[PLAYWRIGHT_SETUP\]\s*\n/m, '');

	return processed;
};
