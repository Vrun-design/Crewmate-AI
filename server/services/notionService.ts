import {getEffectiveIntegrationConfig} from './integrationConfigService';

interface CreateNotionPageInput {
  title: string;
  content: string;
}

interface NotionPageResult {
  id: string;
  url: string;
  title: string;
}

function getNotionConfig(userId: string) {
  const config = getEffectiveIntegrationConfig(userId, 'notion');
  return {
    token: config.token ?? '',
    parentPageId: config.parentPageId ?? '',
  };
}

export function isNotionConfigured(userId: string): boolean {
  const config = getNotionConfig(userId);
  return Boolean(config.token && config.parentPageId);
}

export async function createNotionPage(userId: string, input: CreateNotionPageInput): Promise<NotionPageResult> {
  const config = getNotionConfig(userId);
  if (!isNotionConfigured(userId)) {
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
        title: [
          {
            text: {
              content: input.title,
            },
          },
        ],
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
