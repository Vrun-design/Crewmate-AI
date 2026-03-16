import { isClickUpConfigured } from './clickupService';
import {
  getIntegrationConfigState,
  getIntegrationConfiguredVia,
  listIntegrationFieldDefinitions,
} from './integrationConfigService';
import { isGoogleWorkspaceConfigured } from './googleWorkspaceService';
import { isNotionConfigured } from './notionService';
import { isSlackConfigured } from './slackService';
import type { IntegrationRecord } from '../types';

interface IntegrationDefinition extends Omit<IntegrationRecord, 'status' | 'missingKeys' | 'configuredVia'> {
  status: IntegrationRecord['status'];
}

function getMissingKeys(requiredKeys: string[], integrationId: string, userId: string): string[] {
  const configFields = listIntegrationFieldDefinitions(integrationId);
  const configuredFieldKeys = getIntegrationConfigState(userId, integrationId).fields
    .filter((field) => field.configured)
    .map((field) => field.key);

  return requiredKeys.filter(
    (key) => !configuredFieldKeys.includes(key) && configFields.some((field) => field.key === key),
  );
}

const integrationDefinitions: IntegrationDefinition[] = [
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    status: 'disconnected',
    iconName: 'google-workspace',
    color: 'text-slate-700 dark:text-slate-200',
    bgColor: 'bg-slate-500/10 border-slate-500/20',
    desc: 'Create Docs, Sheets, Slides, Drive folders, Gmail drafts, and Calendar events from one Google connection.',
    docsUrl: 'https://developers.google.com/workspace',
    connectUrl: '/api/integrations/google-workspace/connect',
    capabilities: [
      'Draft Gmail emails and send after explicit confirmation',
      'Create and append Google Docs',
      'Create Sheets and append rows',
      'Create Slides presentations from outlines',
      'Search Drive files and create folders',
      'Create Calendar events with confirmation-aware agents',
    ],
    setupSteps: [
      'Click Connect with Google and sign in with the workspace account you want Crewmate to use.',
      'Approve the requested Google Workspace scopes for Gmail, Drive, Docs, Sheets, Slides, and Calendar.',
      'Choose optional default folder IDs and a default calendar after connecting.',
      'Now tell an agent to create docs, sheets, decks, drafts, or events in Google Workspace.',
    ],
    notes: 'Gmail sending and Calendar event creation remain confirmation-gated even after OAuth is connected.',
    requiredKeys: [],
  },
  {
    id: 'slack',
    name: 'Slack',
    status: 'disconnected',
    iconName: 'slack',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/20',
    desc: 'Post product updates and async summaries into a real Slack channel.',
    docsUrl: 'https://api.slack.com/methods/chat.postMessage',
    connectUrl: '/api/integrations/slack/connect',
    capabilities: ['Post team updates', 'Confirm async work', 'Announce completed research'],
    requiredKeys: [],
    setupSteps: [
      'Click Connect Slack and install Crewmate to your Slack workspace.',
      'Approve messaging access for the bot.',
      'Optionally choose a default channel after connection.',
    ],
    notes: 'OAuth install gives Crewmate a bot token automatically. You only choose a default channel after connecting.',
  },
  {
    id: 'notion',
    name: 'Notion',
    status: 'disconnected',
    iconName: 'notion',
    color: 'text-foreground',
    bgColor: 'bg-foreground/5 border-foreground/10',
    desc: 'Generate PRDs, teardown notes, and meeting summaries as real Notion pages.',
    docsUrl: 'https://developers.notion.com/reference/post-page',
    connectUrl: '/api/integrations/notion/connect',
    capabilities: ['Create pages', 'Write summaries', 'Store async deliverables'],
    requiredKeys: [],
    setupSteps: [
      'Click Connect Notion and approve access to your Notion workspace.',
      'After connecting, optionally choose a default page or database destination.',
      'Now the agent can create pages and store async deliverables in Notion.',
    ],
    notes: 'OAuth replaces manual token setup. A default destination can be selected after connecting.',
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    status: 'disconnected',
    iconName: 'clickup',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
    desc: 'Create structured tasks from bugs, requests, and spoken follow-ups.',
    docsUrl: 'https://developer.clickup.com/reference/createtask',
    capabilities: ['Create tasks', 'Track bugs', 'Capture follow-up work from live sessions'],
    requiredKeys: ['token'],
    setupSteps: [
      'Generate a personal API token from your ClickUp account settings.',
      'Paste the token here and optionally set a default ClickUp list ID.',
      'Now the agent can create and review ClickUp tasks without the OAuth flow.',
    ],
    notes: 'Use a ClickUp personal token plus an optional default list ID for the most stable demo setup.',
  },
];

function getConnectedStatus(workspaceId: string, integrationId: string): IntegrationRecord['status'] {
  if (integrationId === 'slack') {
    return isSlackConfigured(workspaceId) ? 'connected' : 'disconnected';
  }

  if (integrationId === 'notion') {
    return isNotionConfigured(workspaceId) ? 'connected' : 'disconnected';
  }

  if (integrationId === 'google-workspace') {
    return isGoogleWorkspaceConfigured(workspaceId) ? 'connected' : 'disconnected';
  }

  if (integrationId === 'clickup') {
    return isClickUpConfigured(workspaceId) ? 'connected' : 'disconnected';
  }

  return 'disconnected';
}

export function listIntegrationCatalog(workspaceId: string, userId: string): IntegrationRecord[] {
  return integrationDefinitions.map((integration) => ({
    ...integration,
    configuredVia: getIntegrationConfiguredVia(workspaceId, integration.id),
    status: getConnectedStatus(workspaceId, integration.id),
    missingKeys: getMissingKeys(integration.requiredKeys ?? [], integration.id, workspaceId),
  }));
}
