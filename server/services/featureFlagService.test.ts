import { describe, expect, test } from 'vitest';
import { getFeatureFlags, isFeatureEnabled } from './featureFlagService';

describe('featureFlagService', () => {
  test('returns the configured feature flags shape', () => {
    const flags = getFeatureFlags();

    expect(flags).toEqual({
      approvalGates: expect.any(Boolean),
      researchGrounding: expect.any(Boolean),
      slackInbound: expect.any(Boolean),
      uiNavigator: expect.any(Boolean),
    });
  });

  test('reads a single feature flag by name', () => {
    expect(isFeatureEnabled('uiNavigator')).toBe(getFeatureFlags().uiNavigator);
  });
});
