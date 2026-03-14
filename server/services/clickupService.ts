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
  const config = getStoredIntegrationConfig(workspaceId, 'clickup');
  return {
    token: config.token ?? '',
    listId: config.defaultListId ?? config.listId ?? '',
    workspaceName: config.workspaceName ?? '',
    workspaceId: config.clickupWorkspaceId ?? '',
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
  return {
    integrationId: 'clickup',
    configuredVia: isClickUpConfigured(workspaceId) ? 'vault' : 'none',
    fields: [
      {
        key: 'defaultListId',
        label: 'Default ClickUp list ID',
        placeholder: 'Optional list ID',
        secret: false,
        helpText: 'Optional default list where Crewmate should create ClickUp tasks.',
        configured: Boolean(config.listId),
        value: config.listId,
      },
    ],
    connection: {
      status: isClickUpConfigured(workspaceId) ? 'connected' : 'disconnected',
      accountLabel: config.workspaceName || undefined,
      grantedScopes: ['tasks'],
      grantedModules: isClickUpConfigured(workspaceId) ? ['tasks'] : [],
      missingModules: [],
      defaults: {
        defaultListId: config.listId,
      },
    },
  };
}

export function saveClickUpDefaults(workspaceId: string, values: Record<string, string>): IntegrationConfigState {
  const current = getStoredIntegrationConfig(workspaceId, 'clickup');
  const next = { ...current };
  const defaultListId = typeof values.defaultListId === 'string' ? values.defaultListId.trim() : '';
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

export async function createClickUpTask(workspaceId: string, input: CreateClickUpTaskInput): Promise<ClickUpTaskResult> {
  const config = getClickUpConfig(workspaceId);
  if (!isClickUpConfigured(workspaceId)) {
    throw new Error('ClickUp is not connected. Connect ClickUp from the Integrations page first.');
  }

  if (!config.listId) {
    throw new Error('ClickUp is connected, but no default list is selected yet. Choose a default list in Integrations.');
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
