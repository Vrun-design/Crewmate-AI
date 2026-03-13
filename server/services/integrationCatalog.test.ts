import { describe, expect, test } from 'vitest';
import { listIntegrationCatalog } from './integrationCatalog';

describe('integrationCatalog', () => {
  test('includes the core hackathon integrations and required setup metadata', () => {
    const catalog = listIntegrationCatalog('WS-test', 'USR-test');
    const ids = catalog.map((integration) => integration.id);

    expect(ids).toContain('slack');
    expect(ids).toContain('notion');
    expect(ids).toContain('clickup');
    expect(ids).toContain('google-workspace');
    expect(ids).not.toContain('telegram');
    expect(ids).not.toContain('zapier');

    const notion = catalog.find((integration) => integration.id === 'notion');
    expect(notion?.connectUrl).toContain('/api/integrations/notion/connect');
    expect(notion?.docsUrl).toContain('developers.notion.com');

    const googleWorkspace = catalog.find((integration) => integration.id === 'google-workspace');
    expect(googleWorkspace?.connectUrl).toContain('/api/integrations/google-workspace/connect');
    expect(googleWorkspace?.capabilities).toContain('Create and append Google Docs');

    const slack = catalog.find((integration) => integration.id === 'slack');
    expect(slack?.connectUrl).toContain('/api/integrations/slack/connect');
  });
});
