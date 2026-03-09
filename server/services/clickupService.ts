import {getEffectiveIntegrationConfig} from './integrationConfigService';

interface CreateClickUpTaskInput {
  name: string;
  description: string;
}

interface ClickUpTaskResult {
  id: string;
  url: string;
  name: string;
}

function getClickUpConfig(userId: string) {
  const config = getEffectiveIntegrationConfig(userId, 'clickup');
  return {
    token: config.token ?? '',
    listId: config.listId ?? '',
  };
}

export function isClickUpConfigured(userId: string): boolean {
  const config = getClickUpConfig(userId);
  return Boolean(config.token && config.listId);
}

export async function createClickUpTask(userId: string, input: CreateClickUpTaskInput): Promise<ClickUpTaskResult> {
  const config = getClickUpConfig(userId);
  if (!isClickUpConfigured(userId)) {
    throw new Error('ClickUp integration is not configured. Save an API token and destination list ID.');
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
