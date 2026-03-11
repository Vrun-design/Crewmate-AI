import { describe, expect, test } from 'vitest';
import { shouldBlockResourceType } from './browserSession';

describe('browserSession', () => {
  test('blocks heavy resource types', () => {
    expect(shouldBlockResourceType('font')).toBe(true);
    expect(shouldBlockResourceType('media')).toBe(true);
    expect(shouldBlockResourceType('websocket')).toBe(true);
  });

  test('allows normal document resources', () => {
    expect(shouldBlockResourceType('document')).toBe(false);
    expect(shouldBlockResourceType('script')).toBe(false);
  });
});
