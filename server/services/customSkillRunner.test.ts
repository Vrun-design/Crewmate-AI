// @vitest-environment node

import { describe, expect, test } from 'vitest';

const { validateWebhookUrl } = await import('./customSkillRunner');

describe('custom skill webhook policy', () => {
  test('allows localhost targets in development', () => {
    expect(validateWebhookUrl('http://localhost:8787/hook', { appEnv: 'development' }).toString()).toBe('http://localhost:8787/hook');
  });

  test('blocks localhost targets in hosted production', () => {
    expect(() => validateWebhookUrl('https://localhost:8787/hook', { appEnv: 'production' })).toThrow(
      'Hosted production blocks localhost and private-network webhook targets.',
    );
  });

  test('blocks private ipv4 targets in hosted production', () => {
    expect(() => validateWebhookUrl('https://192.168.1.12/hook', { appEnv: 'production' })).toThrow(
      'Hosted production blocks localhost and private-network webhook targets.',
    );
  });

  test('blocks non-https webhook targets in hosted production', () => {
    expect(() => validateWebhookUrl('http://example.com/hook', { appEnv: 'production' })).toThrow(
      'Hosted production only allows HTTPS webhook URLs.',
    );
  });

  test('allows public https webhook targets in hosted production', () => {
    expect(validateWebhookUrl('https://example.com/hook', { appEnv: 'production' }).toString()).toBe('https://example.com/hook');
  });
});
