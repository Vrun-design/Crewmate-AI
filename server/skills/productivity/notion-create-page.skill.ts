import type { Skill } from '../types';
import { inferAutoImageQuery } from '../../services/autoVisuals';
import { createNotionPage } from '../../services/notionService';
import { searchStockImage } from '../../services/imageSearchService';
import { resolveRecentScreenshotArtifact } from '../../services/screenshotArtifactService';

export const notionCreatePageSkill: Skill = {
    id: 'notion.create-page',
    name: 'Create Notion Page',
    description: 'Create a new page in Notion. Use when saving meeting notes, knowledge base articles, PRDs, research briefs, or project documentation.',
    version: '1.0.0',
    category: 'productivity',
    requiresIntegration: ['notion'],
    triggerPhrases: [
        'Save this to Notion',
        'Create a Notion page for this',
        'Add these meeting notes to Notion',
        'Write up a PRD in Notion',
    ],
    preferredModel: 'quick',
    executionMode: 'delegated',
    latencyClass: 'slow',
    sideEffectLevel: 'high',
    exposeInLiveSession: true,
    inputSchema: {
        type: 'object',
        properties: {
            title: { type: 'string', description: 'Page title — compose this yourself based on context. Never leave empty.' },
            content: { type: 'string', description: 'Page body content — compose from context, conversation, or screen. Supports headings (#), bullets (-), numbered lists (1.), to-dos (- [ ]), quotes (>), code fences (```), bookmarks (URL lines), images (image URL lines), and inline links like [label](https://...). Never leave empty.' },
            iconEmoji: { type: 'string', description: 'Optional emoji icon for the page.' },
            coverUrl: { type: 'string', description: 'Optional external image URL for the page cover.' },
            imageQuery: { type: 'string', description: 'Optional stock-image query to use for the page cover and embedded image.' },
            screenshotArtifactId: { type: 'string', description: 'Optional screenshot artifact ID to embed into the page.' },
            screenshotCaption: { type: 'string', description: 'Optional caption to display under the embedded screenshot.' },
        },
        required: ['title', 'content'],
    },
    handler: async (ctx, args) => {
        const title = String(args.title ?? '').trim() || ctx.taskTitle?.trim() || '';
        if (!title) {
            throw new Error('Page title is required to create a Notion page.');
        }
        args = { ...args, title };
        const imageQuery = typeof args.imageQuery === 'string' && args.imageQuery.trim()
            ? args.imageQuery
            : inferAutoImageQuery({
                target: 'notion',
                title: String(args.title ?? ''),
                content: String(args.content ?? ''),
            });
        const stockImage = imageQuery
            ? await searchStockImage(imageQuery)
            : null;
        const screenshot = typeof args.screenshotArtifactId === 'string' && args.screenshotArtifactId.trim()
            ? resolveRecentScreenshotArtifact(ctx.userId, {
                artifactId: args.screenshotArtifactId,
                sessionId: ctx.sessionId,
                taskId: ctx.taskId,
            })
            : null;
        const result = await createNotionPage(ctx.workspaceId, {
            title: String(args.title ?? ''),
            content: stockImage?.url ? `${String(args.content ?? '')}\n\n${stockImage.url}` : String(args.content ?? ''),
            iconEmoji: typeof args.iconEmoji === 'string' ? args.iconEmoji : undefined,
            coverUrl: typeof args.coverUrl === 'string' ? args.coverUrl : stockImage?.url,
            screenshotUrl: screenshot?.publicUrl,
            screenshotCaption: typeof args.screenshotCaption === 'string' ? args.screenshotCaption : screenshot?.caption ?? screenshot?.title ?? undefined,
        });
        return {
            success: true,
            output: result,
            message: `✅ Notion page "${result.title}" created (${result.url})`,
        };
    },
};
