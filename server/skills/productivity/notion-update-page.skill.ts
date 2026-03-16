import type { Skill } from '../types';
import { updateNotionPage } from '../../services/notionService';

export const notionUpdatePageSkill: Skill = {
  id: 'notion.update-page',
  name: 'Update Notion Page',
  description: 'Update an existing Notion page title, icon, or cover. Use when the user wants to rename a doc, add an emoji icon, or change the cover image.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['notion'],
  triggerPhrases: [
    'Rename the Notion page',
    'Update the Notion page title',
    'Add an emoji icon to the Notion page',
    'Change the Notion cover image',
  ],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: false,
  inputSchema: {
    type: 'object',
    properties: {
      pageIdOrUrl: { type: 'string', description: 'Optional target Notion page ID or URL. If omitted, Crewmate will try the most recent Notion page created for this user.' },
      title: { type: 'string', description: 'Optional new page title.' },
      iconEmoji: { type: 'string', description: 'Optional emoji icon. Pass an empty string to clear via structured callers.' },
      coverUrl: { type: 'string', description: 'Optional external image URL for the page cover. Pass an empty string to clear via structured callers.' },
    },
    required: [],
  },
  handler: async (ctx, args) => {
    const result = await updateNotionPage(ctx.workspaceId, ctx.userId, {
      pageIdOrUrl: typeof args.pageIdOrUrl === 'string' && args.pageIdOrUrl.trim() ? String(args.pageIdOrUrl) : undefined,
      title: typeof args.title === 'string' && args.title.trim() ? args.title : undefined,
      iconEmoji: typeof args.iconEmoji === 'string' ? args.iconEmoji : undefined,
      coverUrl: typeof args.coverUrl === 'string' ? args.coverUrl : undefined,
    }, { sessionId: ctx.sessionId });

    return {
      success: true,
      output: result,
      message: `✅ Updated Notion page "${result.title}" (${result.url})`,
    };
  },
};
