import type { Skill } from '../types';
import { parseObjectArgument } from '../framework';
import { createNotionDatabaseRecord } from '../../services/notionService';

function parseProperties(value: unknown): Record<string, unknown> {
  if (typeof value === 'undefined') {
    return {};
  }

  return parseObjectArgument(value, 'properties');
}

export const notionCreateDatabaseRecordSkill: Skill = {
  id: 'notion.create-database-record',
  name: 'Create Notion Database Record',
  description: 'Create a structured record in a Notion database. Use when the target is a database and the user wants structured properties such as status, tags, URL, checkbox, number, or date.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['notion'],
  triggerPhrases: [
    'Create a Notion database record',
    'Add this to the Notion database',
    'Create a row in Notion',
  ],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      databaseIdOrUrl: { type: 'string', description: 'The target Notion database ID or URL.' },
      title: { type: 'string', description: 'Record title.' },
      content: { type: 'string', description: 'Optional body content to include as page blocks.' },
      properties: {
        type: 'object',
        description: 'Optional structured property values keyed by exact Notion property names.',
        properties: {},
        additionalProperties: true,
      },
      iconEmoji: { type: 'string', description: 'Optional emoji icon.' },
      coverUrl: { type: 'string', description: 'Optional external cover image URL.' },
    },
    required: ['databaseIdOrUrl', 'title'],
  },
  handler: async (ctx, args) => {
    const result = await createNotionDatabaseRecord(ctx.workspaceId, {
      databaseIdOrUrl: String(args.databaseIdOrUrl ?? ''),
      title: String(args.title ?? ''),
      content: typeof args.content === 'string' ? args.content : undefined,
      properties: parseProperties(args.properties),
      iconEmoji: typeof args.iconEmoji === 'string' ? args.iconEmoji : undefined,
      coverUrl: typeof args.coverUrl === 'string' ? args.coverUrl : undefined,
    });

    return {
      success: true,
      output: result,
      message: `✅ Notion record "${result.title}" created (${result.url})`,
    };
  },
};
