import type { Skill } from '../types';
import { searchNotionPages } from '../../services/notionService';

export const notionListPagesSkill: Skill = {
    id: 'notion.list-pages',
    name: 'List Notion Pages',
    description: 'List pages inside the configured Notion parent page. Use when the user asks what Notion pages exist, wants to find a document, or needs a page overview.',
    version: '1.0.0',
    category: 'productivity',
    requiresIntegration: ['notion'],
    triggerPhrases: [
        'What pages do I have in Notion?',
        'List my Notion pages',
        'Show me what is in Notion',
        'Find the Notion page for',
    ],
    preferredModel: 'quick',
    executionMode: 'inline',
    latencyClass: 'quick',
    sideEffectLevel: 'none',
    exposeInLiveSession: true,
    inputSchema: {
        type: 'object',
        properties: {},
    },
    handler: async (ctx) => {
        const pages = await searchNotionPages(ctx.workspaceId, { query: '' });
        const summary = pages.map((p) => `• "${p.title}" — ${p.url}`).join('\n');
        return {
            success: true,
            output: pages,
            message: pages.length > 0
                ? `✅ Found ${pages.length} Notion page(s):\n${summary}`
                : 'ℹ️ No child pages found in the configured Notion parent.',
        };
    },
};
