// @vitest-environment node

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

process.env.CREWMATE_DB_PATH = 'data/crewmate.test.db';
process.env.CREWMATE_ENCRYPTION_KEY = 'test-encryption-key';

const { db } = await import('../db');
const { requestLoginCode, verifyLoginCode } = await import('../services/authService');
const {
  createCustomSkill,
  listCustomSkills,
  listSkillsForUser,
  runSkill,
} = await import('./registry');

function createUser(email: string): { id: string; workspaceId: string } {
  const { devCode } = requestLoginCode(email);
  const { user } = verifyLoginCode(email, devCode);
  return { id: user.id, workspaceId: user.workspaceId };
}

function resetDatabase(): void {
  db.exec(`
    DELETE FROM skill_runs;
    DELETE FROM custom_skills;
    DELETE FROM auth_sessions;
    DELETE FROM auth_codes;
    DELETE FROM workspace_members;
    DELETE FROM workspaces;
    DELETE FROM users;
  `);
}

describe('custom skill registry', () => {
  beforeEach(() => {
    resetDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('lists custom skills only for the owning user', () => {
    const alpha = createUser('alpha@example.com');
    const beta = createUser('beta@example.com');

    createCustomSkill({
      id: 'skill-alpha',
      userId: alpha.id,
      name: 'Alpha Skill',
      description: 'Alpha only',
      triggerPhrases: ['alpha'],
      mode: 'recipe',
      recipe: 'Return the input',
      inputSchema: '{"input":{"type":"string","description":"Input text"}}',
    });

    const alphaSkills = listCustomSkills(alpha.id);
    const betaSkills = listCustomSkills(beta.id);
    const alphaAvailableSkills = listSkillsForUser(alpha.id);
    const betaAvailableSkills = listSkillsForUser(beta.id);

    expect(alphaSkills.map((skill) => skill.id)).toContain('skill-alpha');
    expect(betaSkills.map((skill) => skill.id)).not.toContain('skill-alpha');
    expect(alphaAvailableSkills.map((skill) => skill.id)).toContain('custom.skill-alpha');
    expect(betaAvailableSkills.map((skill) => skill.id)).not.toContain('custom.skill-alpha');
  });

  test('stores custom auth headers encrypted at rest', () => {
    const alpha = createUser('alpha@example.com');

    createCustomSkill({
      id: 'skill-secret',
      userId: alpha.id,
      name: 'Secret Skill',
      description: 'Stores an auth header',
      triggerPhrases: ['secret'],
      mode: 'webhook',
      webhookUrl: 'https://example.com/hook',
      authHeader: 'Bearer super-secret-token',
      inputSchema: '{"input":{"type":"string","description":"Input text"}}',
    });

    const row = db.prepare(`
      SELECT auth_header as authHeader, auth_header_encrypted as authHeaderEncrypted
      FROM custom_skills
      WHERE id = ?
    `).get('skill-secret') as { authHeader: string | null; authHeaderEncrypted: string | null };

    expect(row.authHeader).toBeNull();
    expect(row.authHeaderEncrypted).toBeTruthy();
    expect(row.authHeaderEncrypted).not.toContain('super-secret-token');
  });

  test('allows only the owning user to run a custom skill', async () => {
    const alpha = createUser('alpha@example.com');
    const beta = createUser('beta@example.com');

    createCustomSkill({
      id: 'skill-webhook',
      userId: alpha.id,
      name: 'Webhook Skill',
      description: 'Returns a webhook result',
      triggerPhrases: ['webhook'],
      mode: 'webhook',
      webhookUrl: 'https://example.com/hook',
      authHeader: 'Bearer alpha-only',
      inputSchema: '{"input":{"type":"string","description":"Input text"}}',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => '20' },
      text: async () => JSON.stringify({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const alphaResult = await runSkill('custom.skill-webhook', { userId: alpha.id, workspaceId: alpha.workspaceId }, { input: 'hello' });

    expect(alphaResult.result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(
      runSkill('custom.skill-webhook', { userId: beta.id, workspaceId: beta.workspaceId }, { input: 'hello' }),
    ).rejects.toThrow('Skill not found');
  });
});
