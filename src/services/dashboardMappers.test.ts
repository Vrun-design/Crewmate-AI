import {Terminal} from 'lucide-react';
import {describe, expect, test} from 'vitest';
import {mapIntegration} from './dashboardMappers';

describe('dashboardMappers', () => {
  test('maps known integration icon names to icon components', () => {
    const mapped = mapIntegration({
      id: 'slack',
      name: 'Slack',
      status: 'connected',
      iconName: 'slack',
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
      desc: 'Slack integration',
    });

    expect(mapped.icon).not.toBe(Terminal);
  });

  test('maps google workspace to the branded Google asset', () => {
    const mapped = mapIntegration({
      id: 'google-workspace',
      name: 'Google Workspace',
      status: 'connected',
      iconName: 'google-workspace',
      color: 'text-foreground',
      bgColor: 'bg-foreground/10',
      desc: 'Google integration',
    });

    expect(mapped.logoUrl).toBe('/Google.svg');
  });

  test('falls back to Terminal for unknown icon names', () => {
    const mapped = mapIntegration({
      id: 'unknown',
      name: 'Unknown',
      status: 'disconnected',
      iconName: 'missing-icon',
      color: 'text-foreground',
      bgColor: 'bg-foreground/10',
      desc: 'Fallback integration',
    });

    expect(mapped.icon).toBe(Terminal);
  });
});
