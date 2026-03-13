import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { serverConfig } from '../config';
import { decryptJson, encryptJson } from './secretVault';
import type { IntegrationConfigState } from '../types';

const GOOGLE_WORKSPACE_INTEGRATION_ID = 'google-workspace';
const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type GoogleModuleId = 'gmail' | 'drive' | 'docs' | 'sheets' | 'slides' | 'calendar';

type StoredGoogleWorkspaceConfig = {
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: string;
  scopeSet?: string;
  googleUserEmail?: string;
  googleUserId?: string;
  googleUserName?: string;
  defaultDriveFolderId?: string;
  defaultDocsFolderId?: string;
  defaultSheetsFolderId?: string;
  defaultSlidesFolderId?: string;
  defaultCalendarId?: string;
  defaultSendMode?: string;
  gmailSignatureMode?: string;
};

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface OAuthStateRow {
  workspaceId: string;
  userId: string;
  scopeSet: string;
  redirectPath: string | null;
}

const GOOGLE_SCOPE_MODULES: Record<GoogleModuleId, string[]> = {
  gmail: [
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
  ],
  drive: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
  ],
  docs: ['https://www.googleapis.com/auth/documents'],
  sheets: ['https://www.googleapis.com/auth/spreadsheets'],
  slides: ['https://www.googleapis.com/auth/presentations'],
  calendar: ['https://www.googleapis.com/auth/calendar.events'],
};

const GOOGLE_BASE_SCOPES = [
  'openid',
  'email',
  'profile',
  ...new Set(Object.values(GOOGLE_SCOPE_MODULES).flat()),
];

const GOOGLE_WORKSPACE_FIELD_DEFINITIONS = [
  { key: 'defaultDriveFolderId', label: 'Default Drive folder ID', placeholder: 'Optional folder ID', secret: false, helpText: 'Optional folder where Drive files and folders should be created by default.' },
  { key: 'defaultDocsFolderId', label: 'Default Docs folder ID', placeholder: 'Optional folder ID', secret: false, helpText: 'Optional Drive folder for new Google Docs documents.' },
  { key: 'defaultSheetsFolderId', label: 'Default Sheets folder ID', placeholder: 'Optional folder ID', secret: false, helpText: 'Optional Drive folder for new spreadsheets.' },
  { key: 'defaultSlidesFolderId', label: 'Default Slides folder ID', placeholder: 'Optional folder ID', secret: false, helpText: 'Optional Drive folder for new presentations.' },
  { key: 'defaultCalendarId', label: 'Default calendar ID', placeholder: 'primary', secret: false, helpText: 'Defaults to primary if left blank.' },
  { key: 'defaultSendMode', label: 'Default Gmail mode', placeholder: 'draft', secret: false, helpText: 'Use "draft" to prepare email by default. Sending still requires explicit confirmation.' },
  { key: 'gmailSignatureMode', label: 'Gmail signature mode', placeholder: 'account-default', secret: false, helpText: 'Optional label for how the agent should handle Gmail signatures.' },
] as const;

function getStoredGoogleWorkspaceConfig(workspaceId: string): StoredGoogleWorkspaceConfig {
  const row = db.prepare(`
    SELECT encrypted_config as encryptedConfig
    FROM integration_connections
    WHERE workspace_id = ? AND integration_id = ?
  `).get(workspaceId, GOOGLE_WORKSPACE_INTEGRATION_ID) as { encryptedConfig: string } | undefined;

  if (!row) {
    return {};
  }

  return decryptJson(row.encryptedConfig) as StoredGoogleWorkspaceConfig;
}

function saveStoredGoogleWorkspaceConfig(workspaceId: string, nextConfig: StoredGoogleWorkspaceConfig): void {
  const encryptedConfig = encryptJson(nextConfig as Record<string, string>);
  const updatedAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO integration_connections (workspace_id, integration_id, encrypted_config, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(workspace_id, integration_id) DO UPDATE SET
      encrypted_config = excluded.encrypted_config,
      updated_at = excluded.updated_at
  `).run(workspaceId, GOOGLE_WORKSPACE_INTEGRATION_ID, encryptedConfig, updatedAt);
}

function getGrantedScopes(config: StoredGoogleWorkspaceConfig): string[] {
  return (config.scopeSet ?? '')
    .split(' ')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function getGrantedModules(config: StoredGoogleWorkspaceConfig): GoogleModuleId[] {
  const scopes = new Set(getGrantedScopes(config));
  return (Object.keys(GOOGLE_SCOPE_MODULES) as GoogleModuleId[]).filter((moduleId) =>
    GOOGLE_SCOPE_MODULES[moduleId].every((scope) => scopes.has(scope) || GOOGLE_SCOPE_MODULES[moduleId].some((candidate) => scopes.has(candidate))),
  );
}

function getMissingModules(config: StoredGoogleWorkspaceConfig): GoogleModuleId[] {
  const granted = new Set(getGrantedModules(config));
  return (Object.keys(GOOGLE_SCOPE_MODULES) as GoogleModuleId[]).filter((moduleId) => !granted.has(moduleId));
}

function requireGoogleOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = serverConfig.googleWorkspaceClientId.trim();
  const clientSecret = serverConfig.googleWorkspaceClientSecret.trim();
  const redirectUri = serverConfig.googleWorkspaceRedirectUri.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Workspace OAuth is not configured on the server. Set GOOGLE_WORKSPACE_CLIENT_ID, GOOGLE_WORKSPACE_CLIENT_SECRET, and GOOGLE_WORKSPACE_REDIRECT_URI.');
  }

  return { clientId, clientSecret, redirectUri };
}

function getDefaultConfigValues(config: StoredGoogleWorkspaceConfig): Record<string, string> {
  return GOOGLE_WORKSPACE_FIELD_DEFINITIONS.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = config[field.key] ?? '';
    return acc;
  }, {});
}

export function listGoogleWorkspaceFieldDefinitions() {
  return GOOGLE_WORKSPACE_FIELD_DEFINITIONS.map((field) => ({ ...field }));
}

export function isGoogleWorkspaceConfigured(workspaceId: string): boolean {
  const config = getStoredGoogleWorkspaceConfig(workspaceId);
  return Boolean(config.refreshToken || config.accessToken);
}

export function getGoogleWorkspaceConfigState(workspaceId: string): IntegrationConfigState {
  const config = getStoredGoogleWorkspaceConfig(workspaceId);
  const grantedScopes = getGrantedScopes(config);
  const grantedModules = getGrantedModules(config);
  const defaults = getDefaultConfigValues(config);

  return {
    integrationId: GOOGLE_WORKSPACE_INTEGRATION_ID,
    configuredVia: isGoogleWorkspaceConfigured(workspaceId) ? 'vault' : 'none',
    fields: GOOGLE_WORKSPACE_FIELD_DEFINITIONS.map((field) => ({
      ...field,
      configured: Boolean(defaults[field.key]),
      value: defaults[field.key],
    })),
    connection: {
      status: isGoogleWorkspaceConfigured(workspaceId) ? 'connected' : 'disconnected',
      accountEmail: config.googleUserEmail,
      accountLabel: config.googleUserName || config.googleUserEmail,
      grantedScopes,
      grantedModules,
      missingModules: getMissingModules(config),
      defaults,
    },
  };
}

export function saveGoogleWorkspaceDefaults(workspaceId: string, values: Record<string, string>): IntegrationConfigState {
  const current = getStoredGoogleWorkspaceConfig(workspaceId);
  const next = { ...current };

  for (const field of GOOGLE_WORKSPACE_FIELD_DEFINITIONS) {
    const value = typeof values[field.key] === 'string' ? values[field.key].trim() : undefined;
    if (value) {
      next[field.key] = value;
    } else {
      delete next[field.key];
    }
  }

  saveStoredGoogleWorkspaceConfig(workspaceId, next);
  return getGoogleWorkspaceConfigState(workspaceId);
}

export function deleteGoogleWorkspaceConfig(workspaceId: string): void {
  db.prepare(`
    DELETE FROM integration_connections
    WHERE workspace_id = ? AND integration_id = ?
  `).run(workspaceId, GOOGLE_WORKSPACE_INTEGRATION_ID);
}

export function createGoogleWorkspaceConnectUrl(input: {
  workspaceId: string;
  userId: string;
  redirectPath?: string;
}): string {
  const { clientId, redirectUri } = requireGoogleOAuthConfig();

  const state = `gws_${randomUUID()}`;
  const now = Date.now();
  const expiresAt = new Date(now + OAUTH_STATE_TTL_MS).toISOString();
  db.prepare(`
    INSERT INTO oauth_states (state, workspace_id, user_id, auth_token, integration_id, scope_set, redirect_path, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    state,
    input.workspaceId,
    input.userId,
    '',
    GOOGLE_WORKSPACE_INTEGRATION_ID,
    GOOGLE_BASE_SCOPES.join(' '),
    input.redirectPath ?? '/integrations',
    new Date(now).toISOString(),
    expiresAt,
  );

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
    scope: GOOGLE_BASE_SCOPES.join(' '),
  });

  return `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`;
}

function consumeOAuthState(state: string): OAuthStateRow {
  const row = db.prepare(`
    SELECT workspace_id as workspaceId, user_id as userId, scope_set as scopeSet, redirect_path as redirectPath, expires_at as expiresAt
    FROM oauth_states
    WHERE state = ? AND integration_id = ?
  `).get(state, GOOGLE_WORKSPACE_INTEGRATION_ID) as (OAuthStateRow & { expiresAt: string }) | undefined;

  db.prepare(`DELETE FROM oauth_states WHERE state = ?`).run(state);

  if (!row) {
    throw new Error('Google Workspace OAuth state is invalid or expired.');
  }

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw new Error('Google Workspace OAuth state expired. Please try connecting again.');
  }

  return row;
}

async function exchangeCodeForToken(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = requireGoogleOAuthConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json() as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? 'Unable to exchange Google OAuth code.');
  }
  return payload;
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret } = requireGoogleOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json() as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? 'Unable to refresh Google access token.');
  }
  return payload;
}

async function fetchGoogleIdentity(accessToken: string): Promise<{ sub?: string; email?: string; name?: string }> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    return {};
  }

  return response.json() as Promise<{ sub?: string; email?: string; name?: string }>;
}

export async function finalizeGoogleWorkspaceOAuthCallback(input: {
  code: string;
  state: string;
}): Promise<{ redirectUrl: string; workspaceId: string; userId: string }> {
  const state = consumeOAuthState(input.state);
  const tokenPayload = await exchangeCodeForToken(input.code);
  const identity = await fetchGoogleIdentity(tokenPayload.access_token ?? '');
  const current = getStoredGoogleWorkspaceConfig(state.workspaceId);

  saveStoredGoogleWorkspaceConfig(state.workspaceId, {
    ...current,
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token ?? current.refreshToken,
    expiryDate: tokenPayload.expires_in
      ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
      : current.expiryDate,
    scopeSet: tokenPayload.scope ?? state.scopeSet,
    googleUserEmail: identity.email ?? current.googleUserEmail,
    googleUserId: identity.sub ?? current.googleUserId,
    googleUserName: identity.name ?? current.googleUserName,
  });

  const redirectUrl = new URL(state.redirectPath || '/integrations', serverConfig.publicWebAppUrl);
  redirectUrl.searchParams.set('integration', GOOGLE_WORKSPACE_INTEGRATION_ID);
  redirectUrl.searchParams.set('connected', 'true');

  return {
    redirectUrl: redirectUrl.toString(),
    workspaceId: state.workspaceId,
    userId: state.userId,
  };
}

export async function getGoogleWorkspaceAccessToken(workspaceId: string): Promise<string> {
  const config = getStoredGoogleWorkspaceConfig(workspaceId);
  if (!config.refreshToken && !config.accessToken) {
    throw new Error('Google Workspace is not connected. Reconnect the integration first.');
  }

  const now = Date.now();
  const expiry = config.expiryDate ? new Date(config.expiryDate).getTime() : 0;
  if (config.accessToken && expiry > now + 60_000) {
    return config.accessToken;
  }

  if (!config.refreshToken) {
    throw new Error('Google Workspace refresh token is missing. Reconnect the integration first.');
  }

  const refreshed = await refreshAccessToken(config.refreshToken);
  saveStoredGoogleWorkspaceConfig(workspaceId, {
    ...config,
    accessToken: refreshed.access_token,
    expiryDate: refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      : config.expiryDate,
    scopeSet: refreshed.scope ?? config.scopeSet,
  });

  return refreshed.access_token ?? '';
}

export function assertGoogleWorkspaceScopes(workspaceId: string, moduleId: GoogleModuleId): void {
  const config = getStoredGoogleWorkspaceConfig(workspaceId);
  if (!isGoogleWorkspaceConfigured(workspaceId)) {
    throw new Error('Google Workspace is not connected. Connect it from the Integrations page first.');
  }

  const granted = new Set(getGrantedScopes(config));
  const hasScope = GOOGLE_SCOPE_MODULES[moduleId].some((scope) => granted.has(scope));
  if (!hasScope) {
    throw new Error(`Google Workspace is connected, but the ${moduleId} module is missing required Google scopes. Reconnect Google Workspace to grant ${moduleId} access.`);
  }
}

export function getGoogleWorkspaceDefaults(workspaceId: string): Record<string, string> {
  return getDefaultConfigValues(getStoredGoogleWorkspaceConfig(workspaceId));
}

export async function googleWorkspaceApiRequest<T>(input: {
  workspaceId: string;
  moduleId: GoogleModuleId;
  url: string;
  method?: string;
  body?: unknown;
  contentType?: string;
}): Promise<T> {
  assertGoogleWorkspaceScopes(input.workspaceId, input.moduleId);
  const accessToken = await getGoogleWorkspaceAccessToken(input.workspaceId);
  const response = await fetch(input.url, {
    method: input.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(input.body !== undefined ? { 'Content-Type': input.contentType ?? 'application/json' } : {}),
    },
    body: input.body === undefined
      ? undefined
      : input.contentType === 'application/x-www-form-urlencoded'
        ? String(input.body)
        : JSON.stringify(input.body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Workspace API request failed: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
