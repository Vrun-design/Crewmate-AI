import { randomUUID } from 'node:crypto';
import { db } from '../db';
import type { AuthUserRecord } from '../types';
import { serverConfig } from '../config';
import { isFirebaseAuthEnabled, verifyFirebaseIdToken } from './firebaseAdmin';
import { auditLog } from './auditLogger';
import { logServerError } from './runtimeLogger';

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

function mapAuthUser(email: string): AuthUserRecord | null {
  return db.prepare(`
    SELECT u.id, u.email, u.name, u.plan, wm.workspace_id as workspaceId
    FROM users u
    LEFT JOIN workspace_members wm ON u.id = wm.user_id
    WHERE u.email = ?
  `).get(email) as AuthUserRecord | null;
}

function upsertUser(email: string, identity?: { authProvider?: string; authSubject?: string; emailVerified?: boolean; name?: string | null }): AuthUserRecord {
  const existing = db.prepare(`
    SELECT u.id, u.email, u.name, u.plan, u.auth_provider as authProvider, u.auth_subject as authSubject, wm.workspace_id as workspaceId
    FROM users u
    LEFT JOIN workspace_members wm ON u.id = wm.user_id
    WHERE u.email = ?
  `).get(email) as (AuthUserRecord & { authProvider?: string | null; authSubject?: string | null }) | undefined;

  if (existing) {
    if (
      identity
      && (identity.authProvider !== existing.authProvider
        || identity.authSubject !== existing.authSubject
        || identity.name && identity.name !== existing.name)
    ) {
      db.prepare(`
        UPDATE users
        SET name = ?, auth_provider = ?, auth_subject = ?, email_verified = ?
        WHERE email = ?
      `).run(
        identity.name?.trim() || existing.name,
        identity.authProvider ?? existing.authProvider ?? null,
        identity.authSubject ?? existing.authSubject ?? null,
        identity.emailVerified ? 1 : 0,
        email,
      );
    }

    // Workspace may be missing if the DB was partially reset — recreate it.
    if (!existing.workspaceId) {
      const workspaceId = `WS-${existing.id.slice(-8)}`;
      const now = new Date().toISOString();
      db.transaction(() => {
        db.prepare(`INSERT OR IGNORE INTO workspaces (id, name, created_at) VALUES (?, ?, ?)`).run(
          workspaceId, `${existing.name}'s Workspace`, now,
        );
        db.prepare(`INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`).run(
          workspaceId, existing.id, now,
        );
      })();
    }

    return mapAuthUser(email)!;
  }

  const user = {
    id: `USR-${randomUUID()}`,
    email,
    name: identity?.name?.trim() || deriveNameFromEmail(email),
    plan: 'MVP',
    authProvider: identity?.authProvider ?? null,
    authSubject: identity?.authSubject ?? null,
    emailVerified: identity?.emailVerified ? 1 : 0,
    createdAt: new Date().toISOString(),
  };

  const workspaceId = `WS-${user.id.slice(-8)}`;

  db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, name, plan, auth_provider, auth_subject, email_verified, created_at)
      VALUES (@id, @email, @name, @plan, @authProvider, @authSubject, @emailVerified, @createdAt)
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
  if (!serverConfig.exposeDevAuthCode) {
    throw new Error('Development auth is disabled.');
  }

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
  if (!serverConfig.exposeDevAuthCode) {
    throw new Error('Development auth is disabled.');
  }

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
  auditLog({
    type: 'auth.login',
    resource: 'dev-email-code',
    action: 'Development auth session created',
    status: 'success',
    userId: user.id,
    workspaceId: user.workspaceId,
  });

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

export async function resolveAuthUserFromToken(token: string): Promise<AuthUserRecord | null> {
  if (!token) {
    return null;
  }

  if (isFirebaseAuthEnabled()) {
    try {
      const decoded = await verifyFirebaseIdToken(token);
      const email = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : '';
      if (!email) {
        return null;
      }

      const provider = decoded.firebase?.sign_in_provider ?? 'firebase';
      const user = upsertUser(email, {
        authProvider: provider,
        authSubject: decoded.uid,
        emailVerified: Boolean(decoded.email_verified),
        name: typeof decoded.name === 'string' ? decoded.name : typeof decoded.email === 'string' ? deriveNameFromEmail(decoded.email) : null,
      });

      return user;
    } catch (error) {
      logServerError('auth:firebase-verify-id-token', error, {
        firebaseProjectId: serverConfig.firebaseProjectId,
        tokenPrefix: token.slice(0, 12),
        tokenLength: token.length,
      });
      return null;
    }
  }

  return getAuthUser(token);
}
