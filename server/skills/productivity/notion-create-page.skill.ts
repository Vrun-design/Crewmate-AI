import type { Skill } from '../types';
import { createNotionPage } from '../../services/notionService';
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
            title: { type: 'string', description: 'Page title' },
            content: { type: 'string', description: 'Page body content. Supports headings (#), bullets (-), numbered lists (1.), to-dos (- [ ]), quotes (>), code fences (```), bookmarks (URL lines), images (image URL lines), and inline links like [label](https://...).' },
            iconEmoji: { type: 'string', description: 'Optional emoji icon for the page.' },
            coverUrl: { type: 'string', description: 'Optional external image URL for the page cover.' },
            screenshotArtifactId: { type: 'string', description: 'Optional screenshot artifact ID to embed into the page.' },
            screenshotCaption: { type: 'string', description: 'Optional caption to display under the embedded screenshot.' },
        },
        required: ['title', 'content'],
    },
    handler: async (ctx, args) => {
        const screenshot = typeof args.screenshotArtifactId === 'string' && args.screenshotArtifactId.trim()
            ? resolveRecentScreenshotArtifact(ctx.userId, {
                artifactId: args.screenshotArtifactId,
                sessionId: ctx.sessionId,
                taskId: ctx.taskId,
            })
            : null;
        const result = await createNotionPage(ctx.workspaceId, {
            title: String(args.title ?? ''),
            content: String(args.content ?? ''),
            iconEmoji: typeof args.iconEmoji === 'string' ? args.iconEmoji : undefined,
            coverUrl: typeof args.coverUrl === 'string' ? args.coverUrl : undefined,
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
