import type { Skill } from '../types';
import { readNotionPageContent } from '../../services/notionService';

export const notionReadPageSkill: Skill = {
  id: 'notion.read-page',
  name: 'Read Notion Page',
  description: 'Read the full text content of a Notion page by ID or URL. Use this when the user references a Notion page, wants to summarise it, or needs its content for a downstream task like analysis or writing.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['notion'],
  triggerPhrases: ['Read this Notion page', 'Summarise my Notion doc', 'What does this Notion page say'],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'none',
  exposeInLiveSession: false,
  inputSchema: {
    type: 'object',
    properties: {
      pageIdOrUrl: { type: 'string', description: 'Notion page ID or full URL.' },
    },
    required: ['pageIdOrUrl'],
  },
  handler: async (ctx, args) => {
    const result = await readNotionPageContent(ctx.workspaceId, String(args.pageIdOrUrl ?? ''));
    return {
      success: true,
      output: result,
      message: `Read "${result.title}" — ${result.text.length} characters of content.`,
    };
  },
};
