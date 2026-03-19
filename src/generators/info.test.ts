import {describe, it, expect} from 'vitest';
import {getTemplateInfo, getAllTemplatesInfo} from './info.js';

describe('info generator', () => {
	it('should return info for a specific template', () => {
		const info = getTemplateInfo('cli');
		expect(info.name).toBe('cli');
		expect(info.description).toBeDefined();
		expect(info.components).toBeInstanceOf(Array);
		expect(info.components.length).toBeGreaterThan(0);

		// Should include base components
		expect(info.components.some((c) => c.name === 'TypeScript')).toBe(true);
		// Should include cli specific components
		expect(info.components.some((c) => c.name === 'commander')).toBe(true);
	});

	it('should return info for all templates', () => {
		const allInfo = getAllTemplatesInfo();
		expect(allInfo).toHaveLength(4);
		const names = allInfo.map((i) => i.name);
		expect(names).toContain('cli');
		expect(names).toContain('webpage');
		expect(names).toContain('webapp');
		expect(names).toContain('fullstack');
	});
});
