import type { Skill } from '../types';
import { getEffectiveIntegrationConfig } from '../../services/integrationConfigService';

interface NotionPage {
    id: string;
    title: string;
    url: string;
    lastEdited: string;
}

async function listNotionPages(workspaceId: string): Promise<NotionPage[]> {
    const config = getEffectiveIntegrationConfig(workspaceId, 'notion');
    const token = config.token ?? '';
    const parentPageId = config.parentPageId ?? '';

    if (!token || !parentPageId) {
        throw new Error('Notion integration is not configured. Save a token and parent page ID.');
    }

    const response = await fetch(
        `https://api.notion.com/v1/blocks/${parentPageId}/children?page_size=25`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Notion-Version': '2022-06-28',
            },
        },
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Notion list pages failed: ${response.status} ${text}`);
    }

    const payload = await response.json() as {
        results: Array<{
            id: string;
            type: string;
            last_edited_time: string;
            child_page?: { title: string };
        }>;
    };

    return payload.results
        .filter((block) => block.type === 'child_page' && block.child_page?.title)
        .map((block) => ({
            id: block.id,
            title: block.child_page!.title,
            url: `https://notion.so/${block.id.replace(/-/g, '')}`,
            lastEdited: block.last_edited_time,
        }));
}

export const notionListPagesSkill: Skill = {
    id: 'notion.list-pages',
    name: 'List Notion Pages',
    description: 'List pages inside the configured Notion parent page. Use when the user asks what Notion pages exist, wants to find a document, or needs a page overview.',
    version: '1.0.0',
    category: 'productivity',
    personas: ['founder', 'marketer', 'designer', 'developer'],
    requiresIntegration: ['notion'],
    triggerPhrases: [
        'What pages do I have in Notion?',
        'List my Notion pages',
        'Show me what is in Notion',
        'Find the Notion page for',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {},
    },
    handler: async (ctx) => {
        const pages = await listNotionPages(ctx.workspaceId);
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
