import type { Skill } from '../types';
import { searchNotionPages } from '../../services/notionService';

export const notionSearchPagesSkill: Skill = {
  id: 'notion.search-pages',
  name: 'Search Notion Pages',
  description: 'Search Notion pages by title/content relevance. Use when the user asks to find a specific Notion page, doc, PRD, or the page they created earlier.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['notion'],
  triggerPhrases: [
    'Find that Notion page',
    'Search Notion for this',
    'Where is the Notion doc?',
    'Find the page I created earlier',
  ],
  preferredModel: 'quick',
  executionMode: 'either',
  latencyClass: 'quick',
  sideEffectLevel: 'low',
  exposeInLiveSession: false,
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search text such as a title fragment, project name, or doc label.' },
    },
    required: ['query'],
  },
  handler: async (ctx, args) => {
    const result = await searchNotionPages(ctx.workspaceId, {
      query: String(args.query ?? ''),
    });

    return {
      success: true,
      output: result,
      message: result.length > 0
        ? `✅ Found ${result.length} Notion page(s).`
        : 'ℹ️ No matching Notion pages were found.',
    };
  },
};
