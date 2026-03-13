// @vitest-environment node

import { describe, expect, test } from 'vitest';
import { serverConfig } from './config';

describe('db test isolation', () => {
  test('uses a test-only database path under Vitest', () => {
    expect(process.env.VITEST).toBeTruthy();
    expect(process.env.CREWMATE_DB_PATH).toBeTruthy();
    expect(process.env.CREWMATE_DB_PATH).not.toBe('data/crewmate.db');
    expect(serverConfig.databasePath).not.toBe('data/crewmate.db');
    expect(serverConfig.databasePath).toContain('crewmate.test');
  });
});
