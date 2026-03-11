import { Behavior } from '@google/genai';
import { getEffectiveIntegrationConfig } from './integrationConfigService';
import { registerTool } from '../mcp/mcpServer';

interface CreateNotionPageInput {
  title: string;
  content: string;
}

interface NotionPageResult {
  id: string;
  url: string;
  title: string;
}

function getNotionConfig(workspaceId: string) {
  const config = getEffectiveIntegrationConfig(workspaceId, 'notion');
  return {
    token: config.token ?? '',
    parentPageId: config.parentPageId ?? '',
  };
}

export function isNotionConfigured(workspaceId: string): boolean {
  const config = getNotionConfig(workspaceId);
  return Boolean(config.token && config.parentPageId);
}

export async function createNotionPage(workspaceId: string, input: CreateNotionPageInput): Promise<NotionPageResult> {
  const config = getNotionConfig(workspaceId);
  if (!isNotionConfigured(workspaceId)) {
    throw new Error('Notion integration is not configured. Save an integration token and parent page ID.');
  }

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: {
        page_id: config.parentPageId,
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: input.title,
              },
            },
          ],
        },
      },
      children: input.content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: line,
                },
              },
            ],
          },
        })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion page creation failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    id: string;
    url: string;
  };

  return {
    id: payload.id,
    url: payload.url,
    title: input.title,
  };
}

registerTool({
  name: 'create_notion_page',
  description: 'Create a Notion page when the user asks to save a document, knowledge base article, or meeting notes.',
  exposeInLiveSession: true,
  behavior: Behavior.NON_BLOCKING,
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      content: { type: 'string', description: 'Raw text content for the page body.' },
    },
  },
  handler: async (context, args) => {
    return createNotionPage(context.workspaceId, {
      title: typeof args.title === 'string' ? args.title : '',
      content: typeof args.content === 'string' ? args.content : '',
    });
  },
});
