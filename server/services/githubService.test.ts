// @vitest-environment node

import {describe, expect, test} from 'vitest';
import {createGithubIssue, isGithubConfigured} from './githubService';

describe('githubService', () => {
  test('reports unconfigured state without local GitHub env vars', () => {
    expect(isGithubConfigured('USR-test')).toBe(false);
  });

  test('rejects issue creation when GitHub is not configured', async () => {
    await expect(
      createGithubIssue('USR-test', {
        title: 'Test issue',
        body: 'Test body',
      }),
    ).rejects.toThrow('GitHub integration is not configured');
  });
});
