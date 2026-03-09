import {isClickUpConfigured} from './clickupService';
import {
  getIntegrationConfigState,
  getIntegrationConfiguredVia,
  listIntegrationFieldDefinitions,
} from './integrationConfigService';
import {isGithubConfigured} from './githubService';
import {isNotionConfigured} from './notionService';
import {isSlackConfigured} from './slackService';
import type {IntegrationRecord} from '../types';

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
    id: 'github',
    name: 'GitHub',
    status: 'disconnected',
    iconName: 'github',
    color: 'text-foreground',
    bgColor: 'bg-foreground/5 border-foreground/10',
    desc: 'Create issues directly from visual bug reports and engineering conversations.',
    docsUrl: 'https://docs.github.com/en/rest/issues/issues#create-an-issue',
    capabilities: ['Create issues', 'Capture bug context', 'Support GitHub-backed engineering triage'],
    requiredKeys: ['token', 'repoOwner', 'repoName'],
    setupSteps: [
      'Create a GitHub token with repository issue access.',
      'Enter the repository owner and repository name in the connection form.',
      'Use the live session to ask Crewmate to file an issue from screen context.',
    ],
    notes: 'Best first action path because issue creation is deterministic and easy to validate.',
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
    capabilities: ['Post team updates', 'Confirm async work', 'Announce completed research'],
    requiredKeys: ['botToken', 'defaultChannelId'],
    setupSteps: [
      'Create a Slack app and install it to your workspace.',
      'Grant the bot permission to post messages to the target channel.',
      'Save the bot token and default channel ID from the integrations page.',
    ],
    notes: 'Use one default channel per workspace to keep routing simple and reliable.',
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
    capabilities: ['Create pages', 'Write summaries', 'Store async deliverables'],
    requiredKeys: ['token', 'parentPageId'],
    setupSteps: [
      'Create a Notion internal integration and copy the API token.',
      'Share the target parent page with the integration inside Notion.',
      'Save the token and parent page ID from the integrations page.',
    ],
    notes: 'This is the cleanest async artifact path for research handoff and PRD generation.',
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
    requiredKeys: ['token', 'listId'],
    setupSteps: [
      'Create or copy a ClickUp API token for the target workspace.',
      'Find the destination List ID where Crewmate should create tasks.',
      'Save the token and list ID from the integrations page.',
    ],
    notes: 'Strong demo choice when you want product-ops actions outside GitHub.',
  },
];

function getConnectedStatus(userId: string, integrationId: string): IntegrationRecord['status'] {
  if (integrationId === 'github') {
    return isGithubConfigured(userId) ? 'connected' : 'disconnected';
  }

  if (integrationId === 'slack') {
    return isSlackConfigured(userId) ? 'connected' : 'disconnected';
  }

  if (integrationId === 'notion') {
    return isNotionConfigured(userId) ? 'connected' : 'disconnected';
  }

  if (integrationId === 'clickup') {
    return isClickUpConfigured(userId) ? 'connected' : 'disconnected';
  }

  return 'disconnected';
}

export function listIntegrationCatalog(userId: string): IntegrationRecord[] {
  return integrationDefinitions.map((integration) => ({
    ...integration,
    configuredVia: getIntegrationConfiguredVia(userId, integration.id),
    status: getConnectedStatus(userId, integration.id),
    missingKeys: getMissingKeys(integration.requiredKeys ?? [], integration.id, userId),
  }));
}
