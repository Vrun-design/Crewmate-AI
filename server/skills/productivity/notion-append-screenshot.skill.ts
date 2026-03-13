import type { Skill } from '../types';
import { appendScreenshotToNotionPage } from '../../services/notionService';

export const notionAppendScreenshotSkill: Skill = {
  id: 'notion.append-screenshot',
  name: 'Append Screenshot To Notion',
  description: 'Embed the latest or a specific captured screenshot into a Notion page. Use when the user says add this screenshot to Notion or attach the current screen to that document.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['notion'],
  triggerPhrases: [
    'Add this screenshot to Notion',
    'Attach the current screen to the Notion page',
    'Embed this screenshot in the document',
  ],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      pageIdOrUrl: { type: 'string', description: 'Optional target Notion page ID or URL. If omitted, the most recent Notion page is used.' },
      screenshotArtifactId: { type: 'string', description: 'Optional screenshot artifact ID. If omitted, the most recent screenshot is used.' },
      caption: { type: 'string', description: 'Optional caption shown under the screenshot.' },
    },
    required: [],
  },
  handler: async (ctx, args) => {
    const result = await appendScreenshotToNotionPage(
      ctx.workspaceId,
      ctx.userId,
      {
        pageIdOrUrl: typeof args.pageIdOrUrl === 'string' && args.pageIdOrUrl.trim() ? String(args.pageIdOrUrl) : undefined,
        artifactId: typeof args.screenshotArtifactId === 'string' && args.screenshotArtifactId.trim() ? String(args.screenshotArtifactId) : undefined,
        caption: typeof args.caption === 'string' ? args.caption : undefined,
      },
      { sessionId: ctx.sessionId, taskId: ctx.taskId },
    );

    return {
      success: true,
      output: result,
      message: `✅ Added screenshot to Notion page (${result.url})`,
    };
  },
};
