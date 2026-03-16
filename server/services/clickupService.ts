import { serverConfig } from '../config';
import type { IntegrationConfigState } from '../types';
import { consumeOAuthState, createOAuthState, deleteStoredIntegrationConfig, getStoredIntegrationConfig, saveStoredIntegrationConfig } from './integrationOAuthService';

interface CreateClickUpTaskInput {
  name: string;
  description: string;
}

interface ClickUpTaskResult {
  id: string;
  url: string;
  name: string;
}

interface ClickUpAttachmentResult {
  id: string;
  url: string;
  fileName: string;
}

function getClickUpConfig(workspaceId: string) {
  const stored = getStoredIntegrationConfig(workspaceId, 'clickup');
  const envToken = serverConfig.clickupToken.trim();
  const envListId = serverConfig.clickupListId.trim();
  const token = envToken || stored.token || '';
  const listId = envListId || stored.defaultListId || stored.listId || '';
  return {
    token,
    listId,
    workspaceName: stored.workspaceName ?? '',
    workspaceId: stored.clickupWorkspaceId ?? '',
  };
}

export function isClickUpConfigured(workspaceId: string): boolean {
  const config = getClickUpConfig(workspaceId);
  return Boolean(config.token);
}

function requireClickUpOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = serverConfig.clickupClientId.trim();
  const clientSecret = serverConfig.clickupClientSecret.trim();
  const redirectUri = serverConfig.clickupRedirectUri.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('ClickUp OAuth is not configured on the server. Set CLICKUP_CLIENT_ID, CLICKUP_CLIENT_SECRET, and CLICKUP_REDIRECT_URI.');
  }

  return { clientId, clientSecret, redirectUri };
}

export function getClickUpConfigState(workspaceId: string): IntegrationConfigState {
  const config = getClickUpConfig(workspaceId);
  const envTokenConfigured = Boolean(serverConfig.clickupToken.trim());
  const envListConfigured = Boolean(serverConfig.clickupListId.trim());
  const configuredVia = envTokenConfigured || envListConfigured
    ? 'env'
    : isClickUpConfigured(workspaceId)
      ? 'vault'
      : 'none';

  return {
    integrationId: 'clickup',
    configuredVia,
    fields: [
      {
        key: 'token',
        label: 'ClickUp API token',
        placeholder: envTokenConfigured ? 'Configured from environment' : 'pk_... or your ClickUp personal token',
        secret: true,
        helpText: envTokenConfigured
          ? 'A ClickUp token is already configured from the server environment.'
          : 'Paste the ClickUp personal API token you want Crewmate to use.',
        configured: Boolean(config.token),
      },
      {
        key: 'defaultListId',
        label: 'Default ClickUp list ID',
        placeholder: envListConfigured ? 'Configured from environment' : 'Optional list ID',
        secret: false,
        helpText: envListConfigured
          ? 'A default ClickUp list ID is already configured from the server environment.'
          : 'Optional default list where Crewmate should create ClickUp tasks.',
        configured: Boolean(config.listId),
        value: config.listId,
      },
    ],
  };
}

export function saveClickUpDefaults(workspaceId: string, values: Record<string, string>): IntegrationConfigState {
  const current = getStoredIntegrationConfig(workspaceId, 'clickup');
  const next = { ...current };
  const token = typeof values.token === 'string' ? values.token.trim() : '';
  const defaultListId = typeof values.defaultListId === 'string' ? values.defaultListId.trim() : '';
  if (token) {
    next.token = token;
  } else if (!serverConfig.clickupToken.trim()) {
    delete next.token;
  }
  if (defaultListId) {
    next.defaultListId = defaultListId;
  } else {
    delete next.defaultListId;
  }
  saveStoredIntegrationConfig(workspaceId, 'clickup', next);
  return getClickUpConfigState(workspaceId);
}

export function deleteClickUpConfig(workspaceId: string): void {
  deleteStoredIntegrationConfig(workspaceId, 'clickup');
}

export function createClickUpConnectUrl(input: {
  workspaceId: string;
  userId: string;
  redirectPath?: string;
}): string {
  const { clientId, redirectUri } = requireClickUpOAuthConfig();
  const state = createOAuthState({
    workspaceId: input.workspaceId,
    userId: input.userId,
    integrationId: 'clickup',
    scopeSet: 'tasks',
    redirectPath: input.redirectPath,
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  return `https://app.clickup.com/api?${params.toString()}`;
}

export async function finalizeClickUpOAuthCallback(input: { code: string; state: string }): Promise<string> {
  const { clientId, clientSecret, redirectUri } = requireClickUpOAuthConfig();
  const state = consumeOAuthState(input.state, 'clickup');
  const response = await fetch('https://api.clickup.com/api/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      redirect_uri: redirectUri,
    }),
  });
  const payload = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(`ClickUp OAuth failed: ${payload.error ?? response.statusText}`);
  }

  const teamResponse = await fetch('https://api.clickup.com/api/v2/team', {
    headers: {
      Authorization: payload.access_token,
      'Content-Type': 'application/json',
    },
  });
  const teamPayload = await teamResponse.json() as { teams?: Array<{ id: string; name: string }>; err?: string; error?: string };
  if (!teamResponse.ok) {
    throw new Error(`ClickUp workspace lookup failed: ${teamPayload.err ?? teamPayload.error ?? teamResponse.statusText}`);
  }
  const firstTeam = teamPayload.teams?.[0];
  const current = getStoredIntegrationConfig(state.workspaceId, 'clickup');
  saveStoredIntegrationConfig(state.workspaceId, 'clickup', {
    ...current,
    token: payload.access_token,
    workspaceName: firstTeam?.name ?? current.workspaceName ?? '',
    clickupWorkspaceId: firstTeam?.id ?? current.clickupWorkspaceId ?? '',
  });

  const redirectUrl = new URL(state.redirectPath || '/integrations', serverConfig.publicWebAppUrl);
  redirectUrl.searchParams.set('integration', 'clickup');
  redirectUrl.searchParams.set('connected', 'true');
  return redirectUrl.toString();
}

async function autoDiscoverClickUpListId(workspaceId: string, token: string): Promise<string> {
  // teams → spaces → folders/lists — pick the first list found
  const teamsRes = await fetch('https://api.clickup.com/api/v2/team', { headers: { Authorization: token } });
  const teams = await teamsRes.json() as { teams?: Array<{ id: string }> };
  const teamId = teams.teams?.[0]?.id;
  if (!teamId) throw new Error('ClickUp is connected but no workspace was found.');

  const spacesRes = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/space?archived=false`, { headers: { Authorization: token } });
  const spaces = await spacesRes.json() as { spaces?: Array<{ id: string }> };
  const spaceId = spaces.spaces?.[0]?.id;
  if (!spaceId) throw new Error('ClickUp is connected but no space was found in your workspace.');

  const listsRes = await fetch(`https://api.clickup.com/api/v2/space/${spaceId}/list?archived=false`, { headers: { Authorization: token } });
  const lists = await listsRes.json() as { lists?: Array<{ id: string; name: string }> };
  const listId = lists.lists?.[0]?.id;
  if (!listId) throw new Error('ClickUp is connected but no list was found. Create at least one list in ClickUp.');

  // Persist so future calls are instant
  const existing = getStoredIntegrationConfig(workspaceId, 'clickup');
  saveStoredIntegrationConfig(workspaceId, 'clickup', { ...existing, defaultListId: listId });
  return listId;
}

export async function createClickUpTask(workspaceId: string, input: CreateClickUpTaskInput): Promise<ClickUpTaskResult> {
  const config = getClickUpConfig(workspaceId);
  if (!isClickUpConfigured(workspaceId)) {
    throw new Error('ClickUp is not connected. Connect ClickUp from the Integrations page first.');
  }

  if (!config.listId) {
    config.listId = await autoDiscoverClickUpListId(workspaceId, config.token);
  }

  const response = await fetch(`https://api.clickup.com/api/v2/list/${config.listId}/task`, {
    method: 'POST',
    headers: {
      Authorization: config.token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ClickUp task creation failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    id: string;
    url?: string;
    name: string;
  };

  return {
    id: payload.id,
    url: payload.url ?? '',
    name: payload.name,
  };
}

function extractClickUpTaskId(taskIdOrUrl: string): string {
  const trimmed = taskIdOrUrl.trim();
  if (!trimmed) {
    throw new Error('A ClickUp task ID or URL is required.');
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  const slashMatch = trimmed.match(/\/t\/([a-zA-Z0-9]+)/);
  if (slashMatch?.[1]) {
    return slashMatch[1];
  }

  const simpleMatch = trimmed.match(/tasks\/([a-zA-Z0-9]+)/);
  if (simpleMatch?.[1]) {
    return simpleMatch[1];
  }

  throw new Error('Unable to extract a ClickUp task ID from the provided value.');
}

export async function attachFileToClickUpTask(workspaceId: string, input: {
  taskIdOrUrl: string;
  fileName: string;
  bytes: Buffer;
  mimeType: string;
}): Promise<ClickUpAttachmentResult> {
  const config = getClickUpConfig(workspaceId);
  if (!isClickUpConfigured(workspaceId)) {
    throw new Error('ClickUp is not connected. Connect ClickUp from the Integrations page first.');
  }

  const taskId = extractClickUpTaskId(input.taskIdOrUrl);
  const form = new FormData();
  form.append('attachment', new Blob([input.bytes], { type: input.mimeType }), input.fileName);

  const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, {
    method: 'POST',
    headers: {
      Authorization: config.token,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ClickUp attachment upload failed: ${response.status} ${text}`);
  }

  const payload = await response.json() as {
    id?: string;
    url?: string;
    title?: string;
  };

  return {
    id: payload.id ?? taskId,
    url: payload.url ?? '',
    fileName: payload.title ?? input.fileName,
  };
}
