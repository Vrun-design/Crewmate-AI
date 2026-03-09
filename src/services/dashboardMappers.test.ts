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
