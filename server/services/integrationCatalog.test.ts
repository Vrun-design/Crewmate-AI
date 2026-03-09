import {describe, expect, test} from 'vitest';
import {listIntegrationCatalog} from './integrationCatalog';

describe('integrationCatalog', () => {
  test('includes the core hackathon integrations and required setup metadata', () => {
    const catalog = listIntegrationCatalog('USR-test');
    const ids = catalog.map((integration) => integration.id);

    expect(ids).toContain('github');
    expect(ids).toContain('slack');
    expect(ids).toContain('notion');
    expect(ids).toContain('clickup');

    const github = catalog.find((integration) => integration.id === 'github');
    expect(github?.requiredKeys).toContain('token');
    expect(github?.docsUrl).toContain('docs.github.com');
  });
});
