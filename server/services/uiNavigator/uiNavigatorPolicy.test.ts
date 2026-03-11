import { describe, expect, test } from 'vitest';
import { getUiActionSafety, withDerivedUiActionSafety } from './uiNavigatorPolicy';

describe('uiNavigatorPolicy', () => {
  test('marks destructive click actions as confirmation required', () => {
    const safety = getUiActionSafety({
      type: 'click',
      selector: 'button[data-action="delete-account"]',
      reasoning: 'User asked to click the delete button.',
      safety: 'safe',
    });

    expect(safety).toBe('confirmation_required');
  });

  test('blocks obviously dangerous actions', () => {
    const safety = getUiActionSafety({
      type: 'type',
      selector: '#command',
      value: 'drop database',
      reasoning: 'This is destructive.',
      safety: 'safe',
    });

    expect(safety).toBe('blocked');
  });

  test('rewrites action safety from policy', () => {
    const action = withDerivedUiActionSafety({
      type: 'open_url',
      url: 'https://example.com',
      reasoning: 'Open a safe page.',
      safety: 'blocked',
    });

    expect(action.safety).toBe('safe');
  });
});
