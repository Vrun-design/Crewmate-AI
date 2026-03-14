/**
 * browserSessionManager.ts
 *
 * Maintains a lightweight per-user browser cookie store so that login state
 * is reused across tasks.  For example, if the agent logged in to LinkedIn on
 * Monday, Tuesday's task can reuse those cookies without logging in again.
 *
 * Cookies are stored encrypted in the `browser_sessions` SQLite table (created
 * by dbSchema if it does not already exist).
 *
 * Usage:
 *   const cookies = loadUserCookies(userId, 'linkedin.com');
 *   // … inject into Playwright context …
 *   saveUserCookies(userId, 'linkedin.com', cookies);
 */

import { db } from '../../db';
import { decryptJson, encryptJson } from '../secretVault';

export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

function ensureBrowserSessionsTable(): void {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS browser_sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL,
      domain     TEXT NOT NULL,
      cookies    TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, domain)
    )
  `).run();
}

// Ensure table exists on first import
ensureBrowserSessionsTable();

/**
 * Load saved cookies for a specific user + domain.
 * Returns an empty array when nothing is saved yet.
 */
export function loadUserCookies(userId: string, domain: string): StoredCookie[] {
  try {
    const row = db.prepare(`
      SELECT cookies FROM browser_sessions
      WHERE user_id = ? AND domain = ?
    `).get(userId, domain) as { cookies: string } | undefined;

    if (!row) return [];

    const envelope = decryptJson(row.cookies);
    const decrypted = JSON.parse(envelope.data ?? '[]') as StoredCookie[];
    if (!Array.isArray(decrypted)) return [];

    // Filter out expired cookies (negative expires = session cookie, keep those)
    const now = Math.floor(Date.now() / 1000);
    return decrypted.filter((c) => !c.expires || c.expires < 0 || c.expires > now);
  } catch {
    return [];
  }
}

/**
 * Persist cookies for a specific user + domain (upsert).
 * Pass an empty array to effectively clear the session.
 */
export function saveUserCookies(userId: string, domain: string, cookies: StoredCookie[]): void {
  if (!userId || !domain) return;

  try {
    const encrypted = encryptJson({ data: JSON.stringify(cookies) });
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO browser_sessions (user_id, domain, cookies, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, domain) DO UPDATE SET
        cookies = excluded.cookies,
        updated_at = excluded.updated_at
    `).run(userId, domain, encrypted, now);
  } catch {
    // Non-fatal — if we can't save cookies we just start fresh next time
  }
}

/**
 * Clear all saved cookies for a user + domain (e.g. after a logout event).
 */
export function clearUserCookies(userId: string, domain?: string): void {
  if (domain) {
    db.prepare(`DELETE FROM browser_sessions WHERE user_id = ? AND domain = ?`).run(userId, domain);
  } else {
    db.prepare(`DELETE FROM browser_sessions WHERE user_id = ?`).run(userId);
  }
}

/**
 * List all domains that have saved sessions for a user.
 */
export function listUserBrowserSessions(userId: string): Array<{ domain: string; updatedAt: string }> {
  const rows = db.prepare(`
    SELECT domain, updated_at as updatedAt
    FROM browser_sessions
    WHERE user_id = ?
    ORDER BY updated_at DESC
  `).all(userId) as Array<{ domain: string; updatedAt: string }>;

  return rows;
}

/**
 * Extract the apex domain from a URL or hostname string.
 * e.g. "https://www.linkedin.com/feed/" → "linkedin.com"
 */
export function extractApexDomain(urlOrHost: string): string {
  try {
    const host = urlOrHost.startsWith('http') ? new URL(urlOrHost).hostname : urlOrHost;
    const parts = host.replace(/^www\./, '').split('.');
    return parts.slice(-2).join('.');
  } catch {
    return urlOrHost;
  }
}
