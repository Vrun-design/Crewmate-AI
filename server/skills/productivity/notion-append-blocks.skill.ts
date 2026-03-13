import type { Skill } from '../types';
import { appendToNotionPage } from '../../services/notionService';
import { resolveRecentScreenshotArtifact } from '../../services/screenshotArtifactService';

export const notionAppendBlocksSkill: Skill = {
  id: 'notion.append-blocks',
  name: 'Append Notion Content',
  description: 'Append content to an existing Notion page. Use when the user says add this too, continue the document, attach more notes, or add an image/link to a page.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['notion'],
  triggerPhrases: [
    'Add this to the Notion page',
    'Append this to Notion',
    'Continue that Notion document',
    'Add this image to the Notion page',
  ],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      pageIdOrUrl: { type: 'string', description: 'Optional target Notion page ID or URL. If omitted, Crewmate will try the most recent Notion page created for this user.' },
      content: { type: 'string', description: 'Content to append. Supports headings, bullets, checklists, code fences, bookmarks, image URL lines, and inline links.' },
      screenshotArtifactId: { type: 'string', description: 'Optional screenshot artifact ID to embed as an image block.' },
      screenshotCaption: { type: 'string', description: 'Optional caption for the embedded screenshot.' },
    },
    required: ['content'],
  },
  handler: async (ctx, args) => {
    const screenshot = typeof args.screenshotArtifactId === 'string' && args.screenshotArtifactId.trim()
      ? resolveRecentScreenshotArtifact(ctx.userId, {
          artifactId: args.screenshotArtifactId,
          sessionId: ctx.sessionId,
          taskId: ctx.taskId,
        })
      : null;
    const result = await appendToNotionPage(ctx.workspaceId, ctx.userId, {
      pageIdOrUrl: typeof args.pageIdOrUrl === 'string' && args.pageIdOrUrl.trim() ? String(args.pageIdOrUrl) : undefined,
      content: String(args.content ?? ''),
      screenshotUrl: screenshot?.publicUrl,
      screenshotCaption: typeof args.screenshotCaption === 'string' ? args.screenshotCaption : screenshot?.caption ?? screenshot?.title ?? undefined,
    }, { sessionId: ctx.sessionId });

    return {
      success: true,
      output: result,
      message: `✅ Added content to Notion page (${result.url})`,
    };
  },
};
