import {describe, it, expect, vi, beforeEach} from 'vitest';
import {generateProject} from './project.js';
import fse from 'fs-extra';
import {execa} from 'execa';

vi.mock('fs-extra');
vi.mock('execa');

describe('generateProject', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should scaffold a node project correctly', async () => {
		const opts = {
			template: 'node' as const,
			projectName: 'test-project',
			createGithub: false,
			directory: '/tmp/test-project',
		};

		await generateProject(opts);

		expect(fse.ensureDir).toHaveBeenCalledWith('/tmp/test-project');
		expect(fse.writeJson).toHaveBeenCalledWith(expect.stringContaining('package.json'), expect.objectContaining({name: 'test-project'}), expect.anything());
		expect(execa).toHaveBeenCalledWith('git', ['init'], expect.anything());
	});
});
