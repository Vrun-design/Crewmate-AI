import { db } from '../db';
import { serverConfig } from '../config';
import { decryptJson, encryptJson } from './secretVault';
import type {
  IntegrationConfigFieldDefinition,
  IntegrationConfigFieldState,
  IntegrationConfigState,
} from '../types';

const integrationFieldDefinitions: Record<string, IntegrationConfigFieldDefinition[]> = {
  github: [
    { key: 'token', label: 'Access token', placeholder: 'ghp_...', secret: true, helpText: 'Token with issue creation access.' },
    { key: 'repoOwner', label: 'Repository owner', placeholder: 'your-org', secret: false },
    { key: 'repoName', label: 'Repository name', placeholder: 'your-repo', secret: false },
  ],
  slack: [
    { key: 'botToken', label: 'Bot token', placeholder: 'xoxb-...', secret: true, helpText: 'Bot token with chat:write scope.' },
    { key: 'defaultChannelId', label: 'Default channel ID', placeholder: 'C0123456789', secret: false },
  ],
  telegram: [
    { key: 'botToken', label: 'Bot token', placeholder: '123456:ABCDEF...', secret: true, helpText: 'Telegram bot token from BotFather.' },
    { key: 'defaultChatId', label: 'Default chat ID', placeholder: '123456789', secret: false, helpText: 'Only this chat can issue commands and receive updates.' },
    { key: 'webhookSecret', label: 'Webhook secret token', placeholder: 'random-secret-token', secret: true, helpText: 'Used to verify Telegram webhook requests.' },
  ],
  notion: [
    { key: 'token', label: 'Internal integration token', placeholder: 'secret_...', secret: true },
    { key: 'parentPageId', label: 'Parent page ID', placeholder: 'parent-page-id', secret: false },
  ],
  clickup: [
    { key: 'token', label: 'API token', placeholder: 'pk_...', secret: true },
    { key: 'listId', label: 'List ID', placeholder: '901234567890', secret: false },
  ],
  zapier: [
    {
      key: 'webhookUrl',
      label: 'Default Zap webhook URL',
      placeholder: 'https://hooks.zapier.com/hooks/catch/...',
      secret: true,
      helpText: 'Create a "Catch Hook" Zap at zapier.com and paste the webhook URL here.',
    },
    {
      key: 'save-lead-url',
      label: 'Save lead automation URL (optional)',
      placeholder: 'https://hooks.zapier.com/hooks/catch/...',
      secret: true,
      helpText: 'A named Zap for saving leads to your CRM or spreadsheet.',
    },
    {
      key: 'notify-team-url',
      label: 'Notify team automation URL (optional)',
      placeholder: 'https://hooks.zapier.com/hooks/catch/...',
      secret: true,
      helpText: 'A named Zap for sending team notifications (Slack, WhatsApp, email).',
    },
    {
      key: 'custom-1-url',
      label: 'Custom automation URL (optional)',
      placeholder: 'https://hooks.zapier.com/hooks/catch/...',
      secret: true,
      helpText: 'Any additional named Zap you want to trigger from Crewmate.',
    },
  ],
};

const envValueMap: Record<string, Record<string, string>> = {
  github: {
    token: serverConfig.githubToken,
    repoOwner: serverConfig.githubRepoOwner,
    repoName: serverConfig.githubRepoName,
  },
  slack: {
    botToken: serverConfig.slackBotToken,
    defaultChannelId: serverConfig.slackDefaultChannelId,
  },
  telegram: {
    botToken: serverConfig.telegramBotToken,
    defaultChatId: serverConfig.telegramDefaultChatId,
    webhookSecret: serverConfig.telegramWebhookSecret,
  },
  notion: {
    token: serverConfig.notionToken,
    parentPageId: serverConfig.notionParentPageId,
  },
  clickup: {
    token: serverConfig.clickupToken,
    listId: serverConfig.clickupListId,
  },
  zapier: {},
};

function getStoredConfig(workspaceId: string, integrationId: string): Record<string, string> {
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

function getEnvConfig(integrationId: string): Record<string, string> {
  return envValueMap[integrationId] ?? {};
}

export function listIntegrationFieldDefinitions(integrationId: string): IntegrationConfigFieldDefinition[] {
  return integrationFieldDefinitions[integrationId] ?? [];
}

export function getEffectiveIntegrationConfig(workspaceId: string, integrationId: string): Record<string, string> {
  return {
    ...getEnvConfig(integrationId),
    ...getStoredConfig(workspaceId, integrationId),
  };
}

export function getIntegrationConfiguredVia(workspaceId: string, integrationId: string): 'env' | 'vault' | 'none' {
  const stored = getStoredConfig(workspaceId, integrationId);
  if (Object.values(stored).some(Boolean)) {
    return 'vault';
  }

  const envConfig = getEnvConfig(integrationId);
  if (Object.values(envConfig).some(Boolean)) {
    return 'env';
  }

  return 'none';
}

export function getIntegrationConfigState(workspaceId: string, integrationId: string): IntegrationConfigState {
  const fieldDefinitions = listIntegrationFieldDefinitions(integrationId);
  const effective = getEffectiveIntegrationConfig(workspaceId, integrationId);
  const configuredVia = getIntegrationConfiguredVia(workspaceId, integrationId);

  const fields: IntegrationConfigFieldState[] = fieldDefinitions.map((field) => ({
    ...field,
    configured: Boolean(effective[field.key]),
    value: field.secret ? undefined : effective[field.key] ?? '',
  }));

  return {
    integrationId,
    configuredVia,
    fields,
  };
}

export function saveIntegrationConfig(
  workspaceId: string,
  integrationId: string,
  values: Record<string, string>,
): IntegrationConfigState {
  const fieldDefinitions = listIntegrationFieldDefinitions(integrationId);
  if (fieldDefinitions.length === 0) {
    throw new Error(`Unsupported integration: ${integrationId}`);
  }

  const currentStored = getStoredConfig(workspaceId, integrationId);
  const nextStored: Record<string, string> = { ...currentStored };

  for (const field of fieldDefinitions) {
    const nextValue = values[field.key];
    if (typeof nextValue === 'string') {
      const trimmedValue = nextValue.trim();
      if (trimmedValue) {
        nextStored[field.key] = trimmedValue;
      } else if (!field.secret) {
        delete nextStored[field.key];
      }
    }
  }

  const effective = {
    ...getEnvConfig(integrationId),
    ...nextStored,
  };

  for (const field of fieldDefinitions) {
    if (!effective[field.key]) {
      throw new Error(`Missing required field: ${field.label}`);
    }
  }

  const encryptedConfig = encryptJson(nextStored);
  const updatedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO integration_connections (workspace_id, integration_id, encrypted_config, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(workspace_id, integration_id) DO UPDATE SET
      encrypted_config = excluded.encrypted_config,
      updated_at = excluded.updated_at
  `).run(workspaceId, integrationId, encryptedConfig, updatedAt);

  return getIntegrationConfigState(workspaceId, integrationId);
}

export function deleteIntegrationConfig(workspaceId: string, integrationId: string): void {
  db.prepare(`
    DELETE FROM integration_connections
    WHERE workspace_id = ? AND integration_id = ?
  `).run(workspaceId, integrationId);
}
