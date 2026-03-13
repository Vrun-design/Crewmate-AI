import { serverConfig } from '../config';
import type { IntegrationConfigState } from '../types';
import { consumeOAuthState, createOAuthState, deleteStoredIntegrationConfig, getStoredIntegrationConfig, saveStoredIntegrationConfig } from './integrationOAuthService';
import { findLatestArtifactTask } from '../repositories/workspaceRepository';
import { resolveRecentScreenshotArtifact } from './screenshotArtifactService';

const NOTION_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_AUTHORIZE_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';
const NOTION_INTEGRATION_ID = 'notion';
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

type NotionParent = { page_id: string };

type NotionRichText = {
  type: 'text';
  text: {
    content: string;
    link?: { url: string } | null;
  };
};

type NotionBlock =
  | { object: 'block'; type: 'paragraph'; paragraph: { rich_text: NotionRichText[] } }
  | { object: 'block'; type: 'heading_1'; heading_1: { rich_text: NotionRichText[] } }
  | { object: 'block'; type: 'heading_2'; heading_2: { rich_text: NotionRichText[] } }
  | { object: 'block'; type: 'heading_3'; heading_3: { rich_text: NotionRichText[] } }
  | { object: 'block'; type: 'bulleted_list_item'; bulleted_list_item: { rich_text: NotionRichText[] } }
  | { object: 'block'; type: 'numbered_list_item'; numbered_list_item: { rich_text: NotionRichText[] } }
  | { object: 'block'; type: 'to_do'; to_do: { rich_text: NotionRichText[]; checked: boolean } }
  | { object: 'block'; type: 'quote'; quote: { rich_text: NotionRichText[] } }
  | { object: 'block'; type: 'divider'; divider: Record<string, never> }
  | { object: 'block'; type: 'bookmark'; bookmark: { url: string } }
  | { object: 'block'; type: 'image'; image: { type: 'external'; external: { url: string }; caption?: NotionRichText[] } }
  | { object: 'block'; type: 'code'; code: { rich_text: NotionRichText[]; language: string } };

export interface NotionPageResult {
  id: string;
  url: string;
  title: string;
}

export interface CreateNotionPageInput {
  title: string;
  content: string;
  iconEmoji?: string;
  coverUrl?: string;
  screenshotUrl?: string;
  screenshotCaption?: string;
}

export interface UpdateNotionPageInput {
  pageIdOrUrl: string;
  title?: string;
  iconEmoji?: string | null;
  coverUrl?: string | null;
}

export interface AppendNotionBlocksInput {
  pageIdOrUrl?: string;
  content: string;
  screenshotUrl?: string;
  screenshotCaption?: string;
}

export interface SearchNotionPagesInput {
  query: string;
}

export interface CreateNotionDatabaseRecordInput {
  databaseIdOrUrl: string;
  title: string;
  content?: string;
  properties?: Record<string, unknown>;
  iconEmoji?: string;
  coverUrl?: string;
}

function getNotionConfig(workspaceId: string) {
  const config = getStoredIntegrationConfig(workspaceId, NOTION_INTEGRATION_ID);
  return {
    token: config.token ?? '',
    parentPageId: config.defaultParentId ?? config.parentPageId ?? '',
    workspaceName: config.workspaceName ?? '',
  };
}

function requireNotionOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = serverConfig.notionClientId.trim();
  const clientSecret = serverConfig.notionClientSecret.trim();
  const redirectUri = serverConfig.notionRedirectUri.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Notion OAuth is not configured on the server. Set NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, and NOTION_REDIRECT_URI.');
  }

  return { clientId, clientSecret, redirectUri };
}

function getNotionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
}

function extractPageId(pageIdOrUrl: string): string {
  const trimmed = pageIdOrUrl.trim();
  if (!trimmed) {
    throw new Error('A Notion page ID or URL is required.');
  }

  const uuidMatch = trimmed.match(/[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}/);
  if (!uuidMatch) {
    throw new Error('Unable to extract a valid Notion page ID from the provided value.');
  }

  const raw = uuidMatch[0].replace(/-/g, '').toLowerCase();
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20, 32)}`;
}

function extractDatabaseId(databaseIdOrUrl: string): string {
  return extractPageId(databaseIdOrUrl);
}

function isImageUrl(value: string): boolean {
  const lower = value.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.includes(ext));
}

function isBareUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim());
}

function makeRichText(content: string, link?: string | null): NotionRichText {
  return {
    type: 'text',
    text: {
      content,
      link: link ? { url: link } : undefined,
    },
  };
}

function parseInlineRichText(value: string): NotionRichText[] {
  const richText: NotionRichText[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/\S+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      richText.push(makeRichText(value.slice(lastIndex, match.index)));
    }

    if (match[1] && match[2]) {
      richText.push(makeRichText(match[1], match[2]));
    } else if (match[3]) {
      richText.push(makeRichText(match[3], match[3]));
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < value.length) {
    richText.push(makeRichText(value.slice(lastIndex)));
  }

  return richText.filter((item) => item.text.content.length > 0);
}

function paragraphBlock(text: string): NotionBlock {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: parseInlineRichText(text),
    },
  };
}

function headingBlock(level: 1 | 2 | 3, text: string): NotionBlock {
  const key = `heading_${level}` as const;
  return {
    object: 'block',
    type: key,
    [key]: {
      rich_text: parseInlineRichText(text),
    },
  } as NotionBlock;
}

function imageBlock(url: string, caption?: string): NotionBlock {
  return {
    object: 'block',
    type: 'image',
    image: {
      type: 'external',
      external: { url },
      ...(caption?.trim() ? { caption: parseInlineRichText(caption.trim()) } : {}),
    },
  };
}

function buildBlocksFromContent(content: string, options?: { screenshotUrl?: string; screenshotCaption?: string }): NotionBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: NotionBlock[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || 'plain text';
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [makeRichText(codeLines.join('\n'))],
          language,
        },
      });
      continue;
    }

    if (/^#{1,3}\s+/.test(line)) {
      const level = Math.min(3, line.match(/^#+/)?.[0].length ?? 1) as 1 | 2 | 3;
      blocks.push(headingBlock(level, line.replace(/^#{1,3}\s+/, '')));
      continue;
    }

    if (/^[-*]\s+\[[ xX]\]\s+/.test(line)) {
      const checked = /^[-*]\s+\[[xX]\]\s+/.test(line);
      blocks.push({
        object: 'block',
        type: 'to_do',
        to_do: {
          checked,
          rich_text: parseInlineRichText(line.replace(/^[-*]\s+\[[ xX]\]\s+/, '')),
        },
      });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: parseInlineRichText(line.replace(/^[-*]\s+/, '')),
        },
      });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: parseInlineRichText(line.replace(/^\d+\.\s+/, '')),
        },
      });
      continue;
    }

    if (/^>\s+/.test(line)) {
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: {
          rich_text: parseInlineRichText(line.replace(/^>\s+/, '')),
        },
      });
      continue;
    }

    if (/^---+$/.test(line)) {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {},
      });
      continue;
    }

    if (isBareUrl(line)) {
      if (isImageUrl(line)) {
        blocks.push({
          object: 'block',
          type: 'image',
          image: {
            type: 'external',
            external: { url: line },
          },
        });
      } else {
        blocks.push({
          object: 'block',
          type: 'bookmark',
          bookmark: {
            url: line,
          },
        });
      }
      continue;
    }

    blocks.push(paragraphBlock(line));
  }

  if (options?.screenshotUrl) {
    blocks.push(imageBlock(options.screenshotUrl, options.screenshotCaption));
  }

  return blocks;
}

async function notionRequest<T>(workspaceId: string, path: string, init: RequestInit): Promise<T> {
  const config = getNotionConfig(workspaceId);
  if (!config.token) {
    throw new Error('Notion is not connected. Connect Notion from the Integrations page first.');
  }

  const response = await fetch(`${NOTION_API_BASE}${path}`, {
    ...init,
    headers: {
      ...getNotionHeaders(config.token),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion request failed: ${response.status} ${text}`);
  }

  return await response.json() as T;
}

async function resolveRecentNotionPageId(workspaceId: string, userId: string, sessionId?: string): Promise<string> {
  const sessionScoped = sessionId ? findLatestArtifactTask(userId, { provider: 'notion', sessionId }) : null;
  const globalRecent = findLatestArtifactTask(userId, { provider: 'notion' });
  const candidate = sessionScoped?.url ?? globalRecent?.url;
  if (!candidate) {
    throw new Error('No recent Notion page was found. Provide a page ID or URL.');
  }

  return extractPageId(candidate);
}

async function getDatabaseSchema(workspaceId: string, databaseId: string): Promise<Record<string, { id: string; type: string; name: string }>> {
  const payload = await notionRequest<{ properties: Record<string, { id: string; type: string; name: string }> }>(
    workspaceId,
    `/databases/${databaseId}`,
    { method: 'GET' },
  );
  return payload.properties;
}

function mapDatabaseProperties(
  schema: Record<string, { id: string; type: string; name: string }>,
  title: string,
  properties: Record<string, unknown> = {},
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const titleEntry = Object.entries(schema).find(([, value]) => value.type === 'title');
  if (!titleEntry) {
    throw new Error('The target Notion database does not expose a title property.');
  }

  output[titleEntry[0]] = {
    title: [{ text: { content: title } }],
  };

  for (const [key, rawValue] of Object.entries(properties)) {
    const field = schema[key];
    if (!field) {
      continue;
    }

    if (field.type === 'rich_text' && typeof rawValue === 'string') {
      output[key] = {
        rich_text: parseInlineRichText(rawValue),
      };
      continue;
    }

    if (field.type === 'url' && typeof rawValue === 'string') {
      output[key] = { url: rawValue };
      continue;
    }

    if (field.type === 'number' && typeof rawValue === 'number') {
      output[key] = { number: rawValue };
      continue;
    }

    if (field.type === 'checkbox' && typeof rawValue === 'boolean') {
      output[key] = { checkbox: rawValue };
      continue;
    }

    if (field.type === 'select' && typeof rawValue === 'string') {
      output[key] = { select: { name: rawValue } };
      continue;
    }

    if (field.type === 'multi_select' && Array.isArray(rawValue)) {
      output[key] = {
        multi_select: rawValue
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .map((value) => ({ name: value })),
      };
      continue;
    }

    if (field.type === 'date' && typeof rawValue === 'string') {
      output[key] = { date: { start: rawValue } };
    }
  }

  return output;
}

function buildPageDecoration(input: { iconEmoji?: string | null; coverUrl?: string | null }): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.iconEmoji !== undefined) {
    patch.icon = input.iconEmoji
      ? { type: 'emoji', emoji: input.iconEmoji }
      : null;
  }

  if (input.coverUrl !== undefined) {
    patch.cover = input.coverUrl
      ? { type: 'external', external: { url: input.coverUrl } }
      : null;
  }

  return patch;
}

export function isNotionConfigured(workspaceId: string): boolean {
  const config = getNotionConfig(workspaceId);
  return Boolean(config.token);
}

export function getNotionConfigState(workspaceId: string): IntegrationConfigState {
  const config = getNotionConfig(workspaceId);
  return {
    integrationId: NOTION_INTEGRATION_ID,
    configuredVia: isNotionConfigured(workspaceId) ? 'vault' : 'none',
    fields: [
      {
        key: 'defaultParentId',
        label: 'Default Notion destination ID',
        placeholder: 'Optional page or database ID',
        secret: false,
        helpText: 'Optional default page or database destination for new Notion content.',
        configured: Boolean(config.parentPageId),
        value: config.parentPageId,
      },
    ],
    connection: {
      status: isNotionConfigured(workspaceId) ? 'connected' : 'disconnected',
      accountLabel: config.workspaceName || undefined,
      grantedScopes: ['workspace_content'],
      grantedModules: isNotionConfigured(workspaceId) ? ['pages'] : [],
      missingModules: [],
      defaults: {
        defaultParentId: config.parentPageId,
      },
    },
  };
}

export function saveNotionDefaults(workspaceId: string, values: Record<string, string>): IntegrationConfigState {
  const current = getStoredIntegrationConfig(workspaceId, NOTION_INTEGRATION_ID);
  const next = { ...current };
  const defaultParentId = typeof values.defaultParentId === 'string' ? values.defaultParentId.trim() : '';
  if (defaultParentId) {
    next.defaultParentId = defaultParentId;
  } else {
    delete next.defaultParentId;
  }
  saveStoredIntegrationConfig(workspaceId, NOTION_INTEGRATION_ID, next);
  return getNotionConfigState(workspaceId);
}

export function deleteNotionConfig(workspaceId: string): void {
  deleteStoredIntegrationConfig(workspaceId, NOTION_INTEGRATION_ID);
}

export function createNotionConnectUrl(input: {
  workspaceId: string;
  userId: string;
  redirectPath?: string;
}): string {
  const { clientId, redirectUri } = requireNotionOAuthConfig();
  const state = createOAuthState({
    workspaceId: input.workspaceId,
    userId: input.userId,
    integrationId: NOTION_INTEGRATION_ID,
    scopeSet: 'workspace_content',
    redirectPath: input.redirectPath,
  });
  const params = new URLSearchParams({
    owner: 'user',
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  });
  return `${NOTION_AUTHORIZE_URL}?${params.toString()}`;
}

export async function finalizeNotionOAuthCallback(input: { code: string; state: string }): Promise<string> {
  const { clientId, clientSecret, redirectUri } = requireNotionOAuthConfig();
  const state = consumeOAuthState(input.state, NOTION_INTEGRATION_ID);
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: redirectUri,
    }),
  });
  const payload = await response.json() as {
    access_token?: string;
    workspace_name?: string;
    workspace_id?: string;
    bot_id?: string;
    error?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(`Notion OAuth failed: ${payload.error ?? response.statusText}`);
  }
  const current = getStoredIntegrationConfig(state.workspaceId, NOTION_INTEGRATION_ID);
  saveStoredIntegrationConfig(state.workspaceId, NOTION_INTEGRATION_ID, {
    ...current,
    token: payload.access_token,
    workspaceName: payload.workspace_name ?? current.workspaceName ?? '',
    notionWorkspaceId: payload.workspace_id ?? current.notionWorkspaceId ?? '',
    botId: payload.bot_id ?? current.botId ?? '',
  });
  const redirectUrl = new URL(state.redirectPath || '/integrations', serverConfig.publicWebAppUrl);
  redirectUrl.searchParams.set('integration', NOTION_INTEGRATION_ID);
  redirectUrl.searchParams.set('connected', 'true');
  return redirectUrl.toString();
}

export async function createNotionPage(workspaceId: string, input: CreateNotionPageInput): Promise<NotionPageResult> {
  const config = getNotionConfig(workspaceId);
  if (!isNotionConfigured(workspaceId)) {
    throw new Error('Notion is not connected. Connect Notion from the Integrations page first.');
  }

  if (!config.parentPageId) {
    throw new Error('Notion is connected, but no default destination is selected yet. Choose a default destination in Integrations.');
  }

  const children = buildBlocksFromContent(input.content, {
    screenshotUrl: input.screenshotUrl,
    screenshotCaption: input.screenshotCaption,
  });
  const payload = await notionRequest<{ id: string; url: string }>(workspaceId, '/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: {
        page_id: config.parentPageId,
      } satisfies NotionParent,
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
      ...(children.length > 0 ? { children } : {}),
      ...buildPageDecoration({
        iconEmoji: input.iconEmoji,
        coverUrl: input.coverUrl,
      }),
    }),
  });

  return {
    id: payload.id,
    url: payload.url,
    title: input.title,
  };
}

export async function updateNotionPage(
  workspaceId: string,
  userId: string,
  input: UpdateNotionPageInput,
  options?: { sessionId?: string },
): Promise<NotionPageResult> {
  const pageId = input.pageIdOrUrl
    ? extractPageId(input.pageIdOrUrl)
    : await resolveRecentNotionPageId(workspaceId, userId, options?.sessionId);
  const payload = await notionRequest<{ id: string; url: string }>(workspaceId, `/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(input.title
        ? {
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
          }
        : {}),
      ...buildPageDecoration({
        iconEmoji: input.iconEmoji,
        coverUrl: input.coverUrl,
      }),
    }),
  });

  return {
    id: payload.id,
    url: payload.url,
    title: input.title ?? 'Updated Notion page',
  };
}

export async function appendToNotionPage(
  workspaceId: string,
  userId: string,
  input: AppendNotionBlocksInput,
  options?: { sessionId?: string },
): Promise<NotionPageResult> {
  const pageId = input.pageIdOrUrl
    ? extractPageId(input.pageIdOrUrl)
    : await resolveRecentNotionPageId(workspaceId, userId, options?.sessionId);
  const children = buildBlocksFromContent(input.content, {
    screenshotUrl: input.screenshotUrl,
    screenshotCaption: input.screenshotCaption,
  });
  if (children.length === 0) {
    throw new Error('Content is required to append to a Notion page.');
  }

  await notionRequest<{ results: Array<{ id: string }> }>(workspaceId, `/blocks/${pageId}/children`, {
    method: 'PATCH',
    body: JSON.stringify({
      children,
    }),
  });

  return {
    id: pageId,
    url: `https://www.notion.so/${pageId.replace(/-/g, '')}`,
    title: 'Updated Notion page',
  };
}

export async function appendScreenshotToNotionPage(
  workspaceId: string,
  userId: string,
  input: {
    pageIdOrUrl?: string;
    artifactId?: string;
    caption?: string;
  },
  options?: { sessionId?: string; taskId?: string },
): Promise<NotionPageResult> {
  const screenshot = resolveRecentScreenshotArtifact(userId, {
    artifactId: input.artifactId,
    sessionId: options?.sessionId,
    taskId: options?.taskId,
  });

  if (!screenshot) {
    throw new Error('No recent screenshot artifact was found. Capture a screenshot first.');
  }

  return appendToNotionPage(
    workspaceId,
    userId,
    {
      pageIdOrUrl: input.pageIdOrUrl,
      content: '',
      screenshotUrl: screenshot.publicUrl,
      screenshotCaption: input.caption ?? screenshot.caption ?? screenshot.title ?? undefined,
    },
    { sessionId: options?.sessionId },
  );
}

export async function searchNotionPages(workspaceId: string, input: SearchNotionPagesInput): Promise<NotionPageResult[]> {
  const query = input.query.trim();
  const payload = await notionRequest<{ results: Array<{ object: string; id: string; url: string; properties?: Record<string, unknown> }> }>(
    workspaceId,
    '/search',
    {
      method: 'POST',
      body: JSON.stringify({
        query,
        filter: {
          property: 'object',
          value: 'page',
        },
      }),
    },
  );

  return payload.results.map((result) => {
    const titleProperty = Object.values(result.properties ?? {}).find((value) =>
      typeof value === 'object' && value !== null && 'type' in value && (value as { type?: string }).type === 'title',
    ) as { title?: Array<{ plain_text?: string }> } | undefined;
    const title = titleProperty?.title?.map((item) => item.plain_text ?? '').join('').trim() || 'Untitled Notion page';

    return {
      id: result.id,
      url: result.url,
      title,
    };
  });
}

export async function createNotionDatabaseRecord(workspaceId: string, input: CreateNotionDatabaseRecordInput): Promise<NotionPageResult> {
  const databaseId = extractDatabaseId(input.databaseIdOrUrl);
  const schema = await getDatabaseSchema(workspaceId, databaseId);
  const payload = await notionRequest<{ id: string; url: string }>(workspaceId, '/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: {
        database_id: databaseId,
      },
      properties: mapDatabaseProperties(schema, input.title, input.properties),
      ...(input.content?.trim() ? { children: buildBlocksFromContent(input.content) } : {}),
      ...buildPageDecoration({
        iconEmoji: input.iconEmoji,
        coverUrl: input.coverUrl,
      }),
    }),
  });

  return {
    id: payload.id,
    url: payload.url,
    title: input.title,
  };
}

export const __private__ = {
  buildBlocksFromContent,
  extractPageId,
  extractDatabaseId,
  parseInlineRichText,
  mapDatabaseProperties,
};
