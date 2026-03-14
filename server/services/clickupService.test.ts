import { afterEach, describe, expect, test, vi } from 'vitest';
import { serverConfig } from '../config';
import { finalizeClickUpOAuthCallback } from './clickupService';

const { consumeOAuthStateMock, getStoredIntegrationConfigMock, saveStoredIntegrationConfigMock } = vi.hoisted(() => ({
  consumeOAuthStateMock: vi.fn(),
  getStoredIntegrationConfigMock: vi.fn(),
  saveStoredIntegrationConfigMock: vi.fn(),
}));

vi.mock('./integrationOAuthService', () => ({
  createOAuthState: vi.fn(),
  consumeOAuthState: consumeOAuthStateMock,
  deleteStoredIntegrationConfig: vi.fn(),
  getStoredIntegrationConfig: getStoredIntegrationConfigMock,
  saveStoredIntegrationConfig: saveStoredIntegrationConfigMock,
}));

describe('clickupService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    consumeOAuthStateMock.mockReset();
    getStoredIntegrationConfigMock.mockReset();
    saveStoredIntegrationConfigMock.mockReset();
  });

  test('fails cleanly when ClickUp workspace lookup fails after token exchange', async () => {
    serverConfig.clickupClientId = 'clickup-client-id';
    serverConfig.clickupClientSecret = 'clickup-client-secret';
    serverConfig.clickupRedirectUri = 'https://app.example.com/api/integrations/clickup/callback';

    consumeOAuthStateMock.mockReturnValue({
      workspaceId: 'WS-1',
      userId: 'USR-1',
      scopeSet: 'tasks',
      redirectPath: '/integrations',
    });
    getStoredIntegrationConfigMock.mockReturnValue({});

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'clickup-token' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => ({ err: 'Team lookup denied' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    await expect(finalizeClickUpOAuthCallback({ code: 'oauth-code', state: 'oauth-state' })).rejects.toThrow(
      'ClickUp workspace lookup failed: Team lookup denied',
    );
    expect(saveStoredIntegrationConfigMock).not.toHaveBeenCalled();
  });
});
