import { serverConfig } from '../config';
import type { IntegrationConfigState } from '../types';
import { createOAuthState, consumeOAuthState, deleteStoredIntegrationConfig, getStoredIntegrationConfig, saveStoredIntegrationConfig } from './integrationOAuthService';

interface PostSlackMessageInput {
  text: string;
  channelId?: string;
  channelName?: string;
  threadTs?: string | null;
}

interface SlackMessageResult {
  channelId: string;
  timestamp: string;
}

const SLACK_INTEGRATION_ID = 'slack';
const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
// Expanded scopes to support DMs and message history
const SLACK_SCOPES = ['chat:write', 'channels:read', 'channels:history', 'im:write', 'im:history', 'users:read', 'groups:read', 'groups:history'];

function normalizeSlackChannelName(channelName: string): string {
  return channelName.replace(/^#/, '').toLowerCase().trim();
}

function getSlackApiError(prefix: string, error?: string, fallback = 'unknown error'): Error {
  return new Error(`${prefix}: ${error ?? fallback}`);
}

function getSlackConfig(workspaceId: string) {
  const config = getStoredIntegrationConfig(workspaceId, SLACK_INTEGRATION_ID);
  return {
    botToken: config.botToken ?? '',
    defaultChannelId: config.defaultChannelId ?? '',
    slackTeamId: config.slackTeamId ?? '',
    slackTeamName: config.slackTeamName ?? '',
    slackBotUserId: config.slackBotUserId ?? '',
    scopeSet: config.scopeSet ?? '',
  };
}

export function isSlackConfigured(workspaceId: string): boolean {
  const config = getSlackConfig(workspaceId);
  return Boolean(config.botToken);
}

function requireSlackOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = serverConfig.slackClientId.trim();
  const clientSecret = serverConfig.slackClientSecret.trim();
  const redirectUri = serverConfig.slackRedirectUri.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Slack OAuth is not configured on the server. Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REDIRECT_URI.');
  }

  return { clientId, clientSecret, redirectUri };
}

function requireSlackToken(workspaceId: string): string {
  const config = getSlackConfig(workspaceId);
  if (!isSlackConfigured(workspaceId)) {
    throw new Error('Slack is not connected. Connect Slack from the Integrations page first.');
  }
  return config.botToken;
}

export function getSlackConfigState(workspaceId: string): IntegrationConfigState {
  const config = getSlackConfig(workspaceId);
  return {
    integrationId: SLACK_INTEGRATION_ID,
    configuredVia: isSlackConfigured(workspaceId) ? 'vault' : 'none',
    fields: [
      {
        key: 'defaultChannelId',
        label: 'Default Slack channel ID',
        placeholder: 'C0123456789',
        secret: false,
        helpText: 'Optional default channel for team updates and async notifications.',
        configured: Boolean(config.defaultChannelId),
        value: config.defaultChannelId,
      },
    ],
    connection: {
      status: isSlackConfigured(workspaceId) ? 'connected' : 'disconnected',
      accountEmail: undefined,
      accountLabel: config.slackTeamName || undefined,
      grantedScopes: config.scopeSet ? config.scopeSet.split(',').filter(Boolean) : [],
      grantedModules: isSlackConfigured(workspaceId) ? ['messaging', 'dms', 'history'] : [],
      missingModules: [],
      defaults: {
        defaultChannelId: config.defaultChannelId,
      },
    },
  };
}

export function saveSlackDefaults(workspaceId: string, values: Record<string, string>): IntegrationConfigState {
  const current = getStoredIntegrationConfig(workspaceId, SLACK_INTEGRATION_ID);
  const next = { ...current };
  const channelId = typeof values.defaultChannelId === 'string' ? values.defaultChannelId.trim() : '';
  if (channelId) {
    next.defaultChannelId = channelId;
  } else {
    delete next.defaultChannelId;
  }
  saveStoredIntegrationConfig(workspaceId, SLACK_INTEGRATION_ID, next);
  return getSlackConfigState(workspaceId);
}

export function deleteSlackConfig(workspaceId: string): void {
  deleteStoredIntegrationConfig(workspaceId, SLACK_INTEGRATION_ID);
}

export function createSlackConnectUrl(input: {
  workspaceId: string;
  userId: string;
  redirectPath?: string;
}): string {
  const { clientId, redirectUri } = requireSlackOAuthConfig();
  const state = createOAuthState({
    workspaceId: input.workspaceId,
    userId: input.userId,
    integrationId: SLACK_INTEGRATION_ID,
    scopeSet: SLACK_SCOPES.join(','),
    redirectPath: input.redirectPath,
  });
  const params = new URLSearchParams({
    client_id: clientId,
    scope: SLACK_SCOPES.join(','),
    redirect_uri: redirectUri,
    state,
  });
  return `${SLACK_AUTHORIZE_URL}?${params.toString()}`;
}

export async function finalizeSlackOAuthCallback(input: { code: string; state: string }): Promise<string> {
  const { clientId, clientSecret, redirectUri } = requireSlackOAuthConfig();
  const state = consumeOAuthState(input.state, SLACK_INTEGRATION_ID);
  const body = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });
  const response = await fetch(SLACK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json() as {
    ok: boolean;
    access_token?: string;
    scope?: string;
    team?: { id?: string; name?: string };
    bot_user_id?: string;
    error?: string;
  };

  if (!response.ok || !payload.ok || !payload.access_token) {
    throw new Error(`Slack OAuth failed: ${payload.error ?? response.statusText}`);
  }

  const current = getStoredIntegrationConfig(state.workspaceId, SLACK_INTEGRATION_ID);
  saveStoredIntegrationConfig(state.workspaceId, SLACK_INTEGRATION_ID, {
    ...current,
    botToken: payload.access_token,
    scopeSet: payload.scope ?? current.scopeSet ?? '',
    slackTeamId: payload.team?.id ?? current.slackTeamId ?? '',
    slackTeamName: payload.team?.name ?? current.slackTeamName ?? '',
    slackBotUserId: payload.bot_user_id ?? current.slackBotUserId ?? '',
  });

  const redirectUrl = new URL(state.redirectPath || '/integrations', serverConfig.publicWebAppUrl);
  redirectUrl.searchParams.set('integration', SLACK_INTEGRATION_ID);
  redirectUrl.searchParams.set('connected', 'true');
  return redirectUrl.toString();
}

/** Look up channels and resolve a human name (e.g. "engineering" or "#engineering") to a channel ID */
export async function resolveSlackChannelName(workspaceId: string, channelName: string): Promise<string> {
  const normalized = normalizeSlackChannelName(channelName);
  const channels = await listSlackChannels(workspaceId);
  const match = channels.find((ch) => ch.name.toLowerCase() === normalized);
  if (!match) {
    throw new Error(`Slack channel "${channelName}" not found. Available channels: ${channels.map((c) => `#${c.name}`).join(', ')}`);
  }
  return match.id;
}

async function autoDiscoverSlackChannel(workspaceId: string, token: string): Promise<string> {
  const res = await fetch('https://slack.com/api/conversations.list?types=public_channel&limit=200&exclude_archived=true', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json() as { ok: boolean; channels?: Array<{ id: string; name: string }> };
  const channels = data.channels ?? [];
  // Prefer #general, otherwise take the first available channel
  const channel = channels.find((c) => c.name === 'general') ?? channels[0];
  if (!channel) throw new Error('Slack is connected but no channels are accessible. Make sure the Crewmate app is added to at least one channel.');

  // Persist so future calls are instant
  const existing = getStoredIntegrationConfig(workspaceId, 'slack');
  saveStoredIntegrationConfig(workspaceId, 'slack', { ...existing, defaultChannelId: channel.id });
  return channel.id;
}

export async function postSlackMessage(workspaceId: string, input: PostSlackMessageInput): Promise<SlackMessageResult> {
  const token = requireSlackToken(workspaceId);
  const config = getSlackConfig(workspaceId);

  let channelId = input.channelId ?? '';

  // Auto-resolve channel name to ID if provided
  if (!channelId && input.channelName) {
    channelId = await resolveSlackChannelName(workspaceId, input.channelName);
  }

  // Fall back to default channel
  if (!channelId) {
    channelId = config.defaultChannelId;
  }

  if (!channelId) {
    channelId = await autoDiscoverSlackChannel(workspaceId, token);
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel: channelId,
      text: input.text,
      ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
    }),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    channel?: string;
    ts?: string;
    error?: string;
  };

  if (!response.ok || !payload.ok || !payload.channel || !payload.ts) {
    throw new Error(`Slack message failed: ${payload.error ?? response.statusText}`);
  }

  return {
    channelId: payload.channel,
    timestamp: payload.ts,
  };
}

export async function listSlackChannels(workspaceId: string): Promise<Array<{ id: string; name: string; topic: string; memberCount: number }>> {
  const token = requireSlackToken(workspaceId);

  const response = await fetch(
    'https://slack.com/api/conversations.list?limit=100&exclude_archived=true&types=public_channel,private_channel',
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const payload = await response.json() as {
    ok: boolean;
    channels?: Array<{
      id: string;
      name: string;
      topic: { value: string };
      num_members: number;
    }>;
    error?: string;
  };

  if (!payload.ok) {
    throw getSlackApiError('Slack list channels failed', payload.error);
  }

  return (payload.channels ?? []).map((ch) => ({
    id: ch.id,
    name: ch.name,
    topic: ch.topic?.value ?? '',
    memberCount: ch.num_members ?? 0,
  }));
}

/** Get recent messages from a Slack channel */
export async function getSlackMessages(
  workspaceId: string,
  channelId: string,
  limit = 10,
): Promise<Array<{ ts: string; userId: string; text: string }>> {
  const token = requireSlackToken(workspaceId);

  const params = new URLSearchParams({ channel: channelId, limit: String(limit) });
  const response = await fetch(`https://slack.com/api/conversations.history?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = await response.json() as {
    ok: boolean;
    messages?: Array<{ ts: string; user?: string; bot_id?: string; text?: string }>;
    error?: string;
  };

  if (!payload.ok) {
    throw getSlackApiError('Slack get messages failed', payload.error);
  }

  return (payload.messages ?? []).map((msg) => ({
    ts: msg.ts,
    userId: msg.user ?? msg.bot_id ?? 'unknown',
    text: msg.text ?? '',
  }));
}

/** List IM (DM) conversations and return recent messages from a specific user's DM channel */
export async function getSlackDMs(
  workspaceId: string,
  targetUserId: string,
  limit = 10,
): Promise<Array<{ ts: string; userId: string; text: string }>> {
  const token = requireSlackToken(workspaceId);

  // Step 1: find the DM channel for the target user via conversations.open
  const openResp = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ users: targetUserId, return_im: true }),
  });
  const openPayload = await openResp.json() as { ok: boolean; channel?: { id: string }; error?: string };
  if (!openPayload.ok || !openPayload.channel?.id) {
    throw getSlackApiError('Failed to open Slack DM channel', openPayload.error);
  }

  const dmChannelId = openPayload.channel.id;

  // Step 2: fetch history from that DM channel
  return getSlackMessages(workspaceId, dmChannelId, limit);
}

/** List all open IM (DM) channels for the bot */
export async function listSlackDMChannels(workspaceId: string): Promise<Array<{ id: string; userId: string }>> {
  const token = requireSlackToken(workspaceId);

  const params = new URLSearchParams({ types: 'im', limit: '100', exclude_archived: 'true' });
  const response = await fetch(`https://slack.com/api/conversations.list?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json() as {
    ok: boolean;
    channels?: Array<{ id: string; user?: string }>;
    error?: string;
  };

  if (!payload.ok) {
    throw getSlackApiError('Slack list DM channels failed', payload.error);
  }

  return (payload.channels ?? [])
    .filter((ch) => Boolean(ch.user))
    .map((ch) => ({ id: ch.id, userId: ch.user! }));
}

/** Send a direct message to a Slack user by userId or display name */
export async function sendSlackDM(
  workspaceId: string,
  recipientId: string,
  text: string,
): Promise<SlackMessageResult> {
  const token = requireSlackToken(workspaceId);

  // Open a DM conversation
  const openResp = await fetch('https://slack.com/api/conversations.open', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ users: recipientId }),
  });
  const openPayload = await openResp.json() as { ok: boolean; channel?: { id: string }; error?: string };
  if (!openPayload.ok || !openPayload.channel?.id) {
    throw getSlackApiError('Failed to open Slack DM', openPayload.error);
  }

  return postSlackMessage(workspaceId, { channelId: openPayload.channel.id, text });
}

/** Resolve a Slack user's display name or real name to their user ID */
export async function lookupSlackUserByName(workspaceId: string, name: string): Promise<string> {
  const token = requireSlackToken(workspaceId);
  const normalized = name.toLowerCase().replace(/^@/, '').trim();

  const response = await fetch('https://slack.com/api/users.list?limit=200', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json() as {
    ok: boolean;
    members?: Array<{ id: string; name: string; real_name?: string; profile?: { display_name?: string; real_name?: string } }>;
    error?: string;
  };

  if (!payload.ok) {
    throw getSlackApiError('Slack users.list failed', payload.error);
  }

  const match = (payload.members ?? []).find((u) =>
    u.name.toLowerCase() === normalized ||
    u.real_name?.toLowerCase() === normalized ||
    u.profile?.display_name?.toLowerCase() === normalized ||
    u.profile?.real_name?.toLowerCase() === normalized,
  );

  if (!match) {
    throw new Error(`Slack user "${name}" not found. Make sure to use the exact display name or @handle.`);
  }

  return match.id;
}
