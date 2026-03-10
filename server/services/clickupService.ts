import { getEffectiveIntegrationConfig } from './integrationConfigService';
import { registerTool } from '../mcp/mcpServer';

interface CreateClickUpTaskInput {
  name: string;
  description: string;
}

interface ClickUpTaskResult {
  id: string;
  url: string;
  name: string;
}

function getClickUpConfig(workspaceId: string) {
  const config = getEffectiveIntegrationConfig(workspaceId, 'clickup');
  return {
    token: config.token ?? '',
    listId: config.listId ?? '',
  };
}

export function isClickUpConfigured(workspaceId: string): boolean {
  const config = getClickUpConfig(workspaceId);
  return Boolean(config.token && config.listId);
}

export async function createClickUpTask(workspaceId: string, input: CreateClickUpTaskInput): Promise<ClickUpTaskResult> {
  const config = getClickUpConfig(workspaceId);
  if (!isClickUpConfigured(workspaceId)) {
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

registerTool({
  name: 'create_clickup_task',
  description: 'Create a ticket or task in ClickUp when the user asks to log a task, bug, or to-do item.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
    },
  },
  handler: async (context, args) => {
    const description = typeof args.description === 'string' ? args.description : '';
    const screenshotSection = context.frameData
      ? `\n\n[Screenshot captured at time of delegation — base64 image attached at creation time]`
      : '';

    return createClickUpTask(context.workspaceId, {
      name: typeof args.name === 'string' ? args.name : '',
      description: `${description}${screenshotSection}`,
    });
  },
});
