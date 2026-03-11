import { describe, expect, test } from 'vitest';
import { buildFallbackSelector } from './browserObservation';

describe('browserObservation', () => {
  test('builds deterministic fallback selectors', () => {
    expect(buildFallbackSelector('button', 0)).toBe('button:nth-of-type(1)');
    expect(buildFallbackSelector('A', 2)).toBe('a:nth-of-type(3)');
  });
});
