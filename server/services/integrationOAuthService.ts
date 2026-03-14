import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { decryptJson, encryptJson } from './secretVault';

interface CreateOAuthStateInput {
  workspaceId: string;
  userId: string;
  integrationId: string;
  scopeSet: string;
  redirectPath?: string;
}

interface OAuthStateRecord {
  workspaceId: string;
  userId: string;
  scopeSet: string;
  redirectPath: string | null;
}

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export function getStoredIntegrationConfig(workspaceId: string, integrationId: string): Record<string, string> {
  const row = db.prepare(`
    SELECT encrypted_config as encryptedConfig
    FROM integration_connections
    WHERE workspace_id = ? AND integration_id = ?
  `).get(workspaceId, integrationId) as { encryptedConfig: string } | undefined;

  if (!row) {
    return {};
  }

  return decryptJson(row.encryptedConfig);
}

export function saveStoredIntegrationConfig(
  workspaceId: string,
  integrationId: string,
  values: Record<string, string>,
): void {
  const encryptedConfig = encryptJson(values);
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO integration_connections (workspace_id, integration_id, encrypted_config, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(workspace_id, integration_id) DO UPDATE SET
      encrypted_config = excluded.encrypted_config,
      updated_at = excluded.updated_at
  `).run(workspaceId, integrationId, encryptedConfig, updatedAt);
}

export function deleteStoredIntegrationConfig(workspaceId: string, integrationId: string): void {
  db.prepare(`
    DELETE FROM integration_connections
    WHERE workspace_id = ? AND integration_id = ?
  `).run(workspaceId, integrationId);
}

export function createOAuthState(input: CreateOAuthStateInput): string {
  const state = `oauth_${randomUUID()}`;
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + OAUTH_STATE_TTL_MS);
  db.prepare(`
    INSERT INTO oauth_states (state, workspace_id, user_id, auth_token, integration_id, scope_set, redirect_path, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    state,
    input.workspaceId,
    input.userId,
    '',
    input.integrationId,
    input.scopeSet,
    input.redirectPath ?? '/integrations',
    createdAt.toISOString(),
    expiresAt.toISOString(),
  );
  return state;
}

export function consumeOAuthState(state: string, integrationId: string): OAuthStateRecord {
  const row = db.prepare(`
    SELECT workspace_id as workspaceId, user_id as userId, scope_set as scopeSet, redirect_path as redirectPath, expires_at as expiresAt
    FROM oauth_states
    WHERE state = ? AND integration_id = ?
  `).get(state, integrationId) as (OAuthStateRecord & { expiresAt: string }) | undefined;

  db.prepare(`DELETE FROM oauth_states WHERE state = ?`).run(state);

  if (!row) {
    throw new Error(`${integrationId} OAuth state is invalid or expired.`);
  }

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw new Error(`${integrationId} OAuth state expired. Please reconnect and try again.`);
  }

  return row;
}

export function getOAuthStateRedirectPath(state: string, integrationId: string): string | null {
  const row = db.prepare(`
    SELECT redirect_path as redirectPath
    FROM oauth_states
    WHERE state = ? AND integration_id = ?
  `).get(state, integrationId) as { redirectPath: string | null } | undefined;

  return row?.redirectPath ?? null;
}
