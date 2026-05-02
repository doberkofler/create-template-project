import {describe, expect, it} from 'vitest';
import {greet, calculateProgress} from './lib.js';

describe('lib', () => {
	it('greet returns correct message', () => {
		expect(greet('Vitest')).toBe('Hello, Vitest! Welcome to your new CLI.');
	});

	it('calculateProgress works correctly', () => {
		expect(calculateProgress(50, 100)).toBe(50);
		expect(calculateProgress(1, 3)).toBe(33);
		expect(calculateProgress(0, 100)).toBe(0);
		expect(calculateProgress(50, 0)).toBe(0);
	});
});
