import type { Skill } from '../types';
import { createNotionPage } from '../../services/notionService';

export const notionCreatePageSkill: Skill = {
    id: 'notion.create-page',
    name: 'Create Notion Page',
    description: 'Create a new page in Notion. Use when saving meeting notes, knowledge base articles, PRDs, research briefs, or project documentation.',
    version: '1.0.0',
    category: 'productivity',
    personas: ['founder', 'marketer', 'designer', 'developer'],
    requiresIntegration: ['notion'],
    triggerPhrases: [
        'Save this to Notion',
        'Create a Notion page for this',
        'Add these meeting notes to Notion',
        'Write up a PRD in Notion',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Page title' },
            content: { type: 'string', description: 'Page body content — plain text paragraphs' },
        },
        required: ['title', 'content'],
    },
    handler: async (ctx, args) => {
        const result = await createNotionPage(ctx.workspaceId, {
            title: String(args.title ?? ''),
            content: String(args.content ?? ''),
        });
        return {
            success: true,
            output: result,
            message: `✅ Notion page "${result.title}" created (${result.url})`,
        };
    },
};
