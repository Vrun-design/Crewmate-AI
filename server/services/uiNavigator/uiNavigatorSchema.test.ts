import { describe, expect, test } from 'vitest';
import { parseUiPlan } from './uiNavigatorSchema';

describe('uiNavigatorSchema', () => {
  test('parses a valid UI plan', () => {
    const plan = parseUiPlan({
      goal: 'Click the signup button',
      confidence: 0.92,
      action: {
        type: 'click',
        selector: '[data-testid="signup"]',
        reasoning: 'The CTA matches the user intent.',
        safety: 'safe',
      },
    });

    expect(plan.action.type).toBe('click');
    if (plan.action.type !== 'click') {
      throw new Error('Expected click action');
    }
    expect(plan.action.selector).toBe('[data-testid="signup"]');
  });

  test('rejects plans with invalid confidence', () => {
    expect(() => parseUiPlan({
      goal: 'Do something',
      confidence: 2,
      action: {
        type: 'finish',
        summary: 'done',
        reasoning: 'done',
        safety: 'safe',
      },
    })).toThrow(/confidence/i);
  });

  test('rejects malformed actions', () => {
    expect(() => parseUiPlan({
      goal: 'Click',
      confidence: 0.4,
      action: {
        type: 'click',
        reasoning: 'missing selector',
        safety: 'safe',
      },
    })).toThrow(/selector/i);
  });
});
