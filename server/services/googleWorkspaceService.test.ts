import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../db';
import { serverConfig } from '../config';
import {
  createGoogleWorkspaceConnectUrl,
  finalizeGoogleWorkspaceOAuthCallback,
  getGoogleWorkspaceConfigState,
  saveGoogleWorkspaceDefaults,
} from './googleWorkspaceService';

describe('googleWorkspaceService', () => {
  beforeEach(() => {
    serverConfig.encryptionKey = 'test-encryption-key';
    serverConfig.googleWorkspaceClientId = 'google-client-id';
    serverConfig.googleWorkspaceClientSecret = 'google-client-secret';
    serverConfig.googleWorkspaceRedirectUri = 'http://localhost:8787/api/integrations/google-workspace/callback';
    serverConfig.publicWebAppUrl = 'http://localhost:3000';
  });

  afterEach(() => {
    db.prepare(`DELETE FROM oauth_states WHERE integration_id = 'google-workspace'`).run();
    db.prepare(`DELETE FROM integration_connections WHERE integration_id = 'google-workspace'`).run();
    vi.unstubAllGlobals();
  });

  test('builds a Google OAuth connect URL and stores state', () => {
    const connectUrl = createGoogleWorkspaceConnectUrl({
      workspaceId: 'WS-1',
      userId: 'USR-1',
      redirectPath: '/integrations',
    });

    expect(connectUrl).toContain('accounts.google.com');
    const savedStates = db.prepare(`SELECT state, auth_token as authToken FROM oauth_states WHERE integration_id = 'google-workspace'`).all() as Array<{ state: string; authToken: string }>;
    expect(savedStates).toHaveLength(1);
    expect(savedStates[0]?.authToken).toBe('');
    expect(connectUrl).toContain(savedStates[0]?.state);
  });

  test('saves OAuth callback identity and defaults into integration state', async () => {
    const connectUrl = createGoogleWorkspaceConnectUrl({
      workspaceId: 'WS-1',
      userId: 'USR-1',
    });
    const state = new URL(connectUrl).searchParams.get('state');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 3600,
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/presentations https://www.googleapis.com/auth/calendar.events',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'google-user-1',
          email: 'owner@example.com',
          name: 'Owner User',
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await finalizeGoogleWorkspaceOAuthCallback({
      code: 'oauth-code',
      state: state ?? '',
    });

    expect(result.redirectUrl).toContain('connected=true');

    saveGoogleWorkspaceDefaults('WS-1', {
      defaultCalendarId: 'primary',
      defaultSendMode: 'draft',
    });

    const configState = getGoogleWorkspaceConfigState('WS-1');
    expect(configState.connection?.status).toBe('connected');
    expect(configState.connection?.accountEmail).toBe('owner@example.com');
    expect(configState.connection?.grantedModules).toContain('gmail');
    expect(configState.connection?.defaults?.defaultSendMode).toBe('draft');
  });
});
