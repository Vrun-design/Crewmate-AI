import { db } from '../db';
import { serverConfig } from '../config';
import { decryptJson, encryptJson } from './secretVault';
import type {
  IntegrationConfigFieldDefinition,
  IntegrationConfigFieldState,
  IntegrationConfigState,
} from '../types';

const integrationFieldDefinitions: Record<string, IntegrationConfigFieldDefinition[]> = {
  slack: [],
  notion: [],
  clickup: [
    {
      key: 'token',
      label: 'ClickUp API token',
      placeholder: 'pk_... or your ClickUp personal token',
      secret: true,
      helpText: 'Paste the ClickUp personal token Crewmate should use.',
    },
    {
      key: 'defaultListId',
      label: 'Default ClickUp list ID',
      placeholder: 'Optional list ID',
      secret: false,
      helpText: 'Optional default list where Crewmate should create ClickUp tasks.',
    },
  ],
  'google-workspace': [],
};

const envValueMap: Record<string, Record<string, string>> = {
  slack: {
    botToken: serverConfig.slackBotToken,
    defaultChannelId: serverConfig.slackDefaultChannelId,
  },
  notion: {
    token: serverConfig.notionToken,
    parentPageId: serverConfig.notionParentPageId,
  },
  clickup: {
    token: serverConfig.clickupToken,
    listId: serverConfig.clickupListId,
  },
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
