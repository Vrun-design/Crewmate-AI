import { randomUUID } from 'node:crypto';
import { db } from '../db';
import type { AuthUserRecord } from '../types';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;
const CODE_DURATION_MS = 1000 * 60 * 10;

function deriveNameFromEmail(email: string): string {
  const [localPart] = email.split('@');
  return localPart
    .split(/[._-]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ') || 'Crewmate User';
}

function upsertUser(email: string): AuthUserRecord {
  const existing = db.prepare(`
    SELECT u.id, u.email, u.name, u.plan, wm.workspace_id as workspaceId
    FROM users u
    LEFT JOIN workspace_members wm ON u.id = wm.user_id
    WHERE u.email = ?
  `).get(email) as AuthUserRecord | undefined;

  if (existing) {
    return existing;
  }

  const user = {
    id: `USR-${randomUUID()}`,
    email,
    name: deriveNameFromEmail(email),
    plan: 'MVP',
    createdAt: new Date().toISOString(),
  };

  const workspaceId = `WS-${user.id.slice(-8)}`;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, name, plan, created_at)
      VALUES (@id, @email, @name, @plan, @createdAt)
    `).run(user);

    db.prepare(`
      INSERT INTO workspaces (id, name, created_at)
      VALUES (?, ?, ?)
    `).run(workspaceId, `${user.name}'s Workspace`, user.createdAt);

    db.prepare(`
      INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
      VALUES (?, ?, 'owner', ?)
    `).run(workspaceId, user.id, user.createdAt);
  })();

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    workspaceId,
  };
}

export function requestLoginCode(email: string): { email: string; devCode: string } {
  upsertUser(email);
  const code = `${Math.floor(100000 + Math.random() * 900000)}`;
  const expiresAt = new Date(Date.now() + CODE_DURATION_MS).toISOString();

  db.prepare(`
    INSERT INTO auth_codes (email, code, expires_at)
    VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at
  `).run(email, code, expiresAt);

  return { email, devCode: code };
}

export function verifyLoginCode(email: string, code: string): { token: string; user: AuthUserRecord } {
  const row = db.prepare(`
    SELECT code, expires_at as expiresAt
    FROM auth_codes
    WHERE email = ?
  `).get(email) as { code: string; expiresAt: string } | undefined;

  if (!row || row.code !== code || new Date(row.expiresAt).getTime() < Date.now()) {
    throw new Error('Invalid or expired verification code.');
  }

  const token = `auth_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();
  const user = upsertUser(email);

  db.prepare(`
    INSERT INTO auth_sessions (token, email, expires_at)
    VALUES (?, ?, ?)
  `).run(token, email, expiresAt);

  db.prepare(`DELETE FROM auth_codes WHERE email = ?`).run(email);

  return { token, user };
}

export function getAuthUser(token: string): AuthUserRecord | null {
  const session = db.prepare(`
    SELECT email, expires_at as expiresAt
    FROM auth_sessions
    WHERE token = ?
  `).get(token) as { email: string; expiresAt: string } | undefined;

  if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
    return null;
  }

  return db.prepare(`
    SELECT u.id, u.email, u.name, u.plan, wm.workspace_id as workspaceId
    FROM users u
    LEFT JOIN workspace_members wm ON u.id = wm.user_id
    WHERE u.email = ?
  `).get(session.email) as AuthUserRecord | null;
}

export function clearAuthSession(token: string): void {
  db.prepare(`DELETE FROM auth_sessions WHERE token = ?`).run(token);
}
