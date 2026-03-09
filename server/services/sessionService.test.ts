// @vitest-environment node

import {beforeEach, describe, expect, test} from 'vitest';

process.env.CREWMATE_DB_PATH = 'data/crewmate.test.db';

const {db} = await import('../db');
const {getSession} = await import('../repositories/sessionRepository');
const {endSession, startSession} = await import('./sessionService');

function resetDatabase(): void {
  db.exec(`
    DELETE FROM auth_sessions;
    DELETE FROM auth_codes;
    DELETE FROM session_messages;
    DELETE FROM sessions;
    DELETE FROM integration_connections;
    DELETE FROM user_preferences;
    DELETE FROM notifications;
    DELETE FROM tasks;
    DELETE FROM activities;
    DELETE FROM integrations;
    DELETE FROM memory_nodes;
    DELETE FROM users;
  `);
}

describe('sessionService', () => {
  beforeEach(() => {
    resetDatabase();
  });

  test('starts a local session with transcript entries', () => {
    const session = startSession();

    expect(session.status).toBe('live');
    expect(session.provider).toBe('local');
    expect(session.transcript).toHaveLength(2);

    const stored = getSession(session.id);
    expect(stored?.transcript).toHaveLength(2);
  });

  test('ends an active local session and preserves transcript', () => {
    const session = startSession();
    const ended = endSession(session.id);

    expect(ended?.status).toBe('ended');
    expect(ended?.provider).toBe('local');
    expect(ended?.transcript).toHaveLength(2);
  });
});
