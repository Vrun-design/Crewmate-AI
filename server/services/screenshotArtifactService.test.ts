// @vitest-environment node

import { beforeEach, describe, expect, test } from 'vitest';

process.env.CREWMATE_DB_PATH = 'data/crewmate.screenshot.test.db';
process.env.CREWMATE_ARTIFACTS_PATH = 'data/test-artifacts';

const { db } = await import('../db');
const { requestLoginCode, verifyLoginCode } = await import('./authService');
const {
  saveScreenshotArtifact,
  getScreenshotArtifactBytesForUser,
  getPublicScreenshotArtifactFilePath,
  listRecentScreenshotArtifacts,
  revokeScreenshotArtifactShare,
  resolveRecentScreenshotArtifact,
} = await import('./screenshotArtifactService');

function createUser(email: string): { id: string; workspaceId: string } {
  const { devCode } = requestLoginCode(email);
  const { user } = verifyLoginCode(email, devCode);
  return { id: user.id, workspaceId: user.workspaceId };
}

function resetDatabase(): void {
  db.exec(`
    DELETE FROM auth_sessions;
    DELETE FROM auth_codes;
    DELETE FROM session_messages;
    DELETE FROM sessions;
    DELETE FROM integration_connections;
    DELETE FROM workspace_members;
    DELETE FROM workspaces;
    DELETE FROM user_preferences;
    DELETE FROM notifications;
    DELETE FROM tasks;
    DELETE FROM task_runs;
    DELETE FROM activities;
    DELETE FROM integrations;
    DELETE FROM memory_records;
    DELETE FROM screenshot_artifacts;
    DELETE FROM users;
  `);
}

describe('screenshotArtifactService', () => {
  beforeEach(() => {
    resetDatabase();
  });

  test('saves and resolves a screenshot artifact for the owning user', () => {
    const user = createUser('screens@example.com');
    const artifact = saveScreenshotArtifact({
      userId: user.id,
      workspaceId: user.workspaceId,
      sessionId: 'SES-1',
      mimeType: 'image/jpeg',
      data: Buffer.from('fake-image').toString('base64'),
      title: 'Launch screenshot',
      caption: 'Checkout page',
    });

    expect(artifact.id).toMatch(/^SCR-/);
    expect(artifact.publicUrl).toContain(`/api/artifacts/screenshots/${artifact.id}`);

    const latest = resolveRecentScreenshotArtifact(user.id, { sessionId: 'SES-1' });
    expect(latest?.id).toBe(artifact.id);

    const file = getScreenshotArtifactBytesForUser(artifact.id, user.id);
    expect(file?.bytes.toString()).toBe('fake-image');
    expect(file?.mimeType).toBe('image/jpeg');
  });

  test('revokes public screenshot access after share revocation', () => {
    const user = createUser('screens-3@example.com');
    const artifact = saveScreenshotArtifact({
      userId: user.id,
      workspaceId: user.workspaceId,
      sessionId: 'SES-2',
      mimeType: 'image/jpeg',
      data: Buffer.from('revoked-image').toString('base64'),
      title: 'Revoked',
    });
    const token = new URL(artifact.publicUrl).searchParams.get('token') ?? '';

    expect(getPublicScreenshotArtifactFilePath(artifact.id, token)?.mimeType).toBe('image/jpeg');
    revokeScreenshotArtifactShare(artifact.id, user.id);
    expect(getPublicScreenshotArtifactFilePath(artifact.id, token)).toBeNull();
  });

  test('lists recent screenshot artifacts in reverse chronological order', () => {
    const user = createUser('screens-2@example.com');
    saveScreenshotArtifact({
      userId: user.id,
      workspaceId: user.workspaceId,
      sessionId: 'SES-1',
      mimeType: 'image/jpeg',
      data: Buffer.from('first').toString('base64'),
      title: 'First',
    });
    const second = saveScreenshotArtifact({
      userId: user.id,
      workspaceId: user.workspaceId,
      sessionId: 'SES-1',
      mimeType: 'image/jpeg',
      data: Buffer.from('second').toString('base64'),
      title: 'Second',
    });

    const artifacts = listRecentScreenshotArtifacts(user.id, { sessionId: 'SES-1', limit: 2 });
    expect(artifacts[0]?.id).toBe(second.id);
    expect(artifacts).toHaveLength(2);
  });
});
