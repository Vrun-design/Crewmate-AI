import type { Skill } from '../types';
import { uploadImageToNotionPage } from '../../services/notionService';

export const notionUploadImageSkill: Skill = {
  id: 'notion.upload-image',
  name: 'Upload Image to Notion',
  description: 'Insert an image from a URL into a Notion page as an embedded image block. Use when the user wants to add an image, photo, or diagram to a Notion page by URL.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['notion'],
  triggerPhrases: [
    'Add this image to Notion',
    'Insert a photo into the Notion page',
    'Embed this diagram in Notion',
    'Upload this image URL to Notion',
  ],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      imageUrl: { type: 'string', description: 'Public URL of the image to embed (HTTPS).' },
      pageIdOrUrl: { type: 'string', description: 'Optional target Notion page ID or URL. If omitted, the most recent Notion page is used.' },
      caption: { type: 'string', description: 'Optional caption shown under the image.' },
    },
    required: ['imageUrl'],
  },
  handler: async (ctx, args) => {
    const imageUrl = String(args.imageUrl ?? '').trim();
    if (!imageUrl) throw new Error('imageUrl is required');

    const result = await uploadImageToNotionPage(
      ctx.workspaceId,
      ctx.userId,
      {
        imageUrl,
        pageIdOrUrl: typeof args.pageIdOrUrl === 'string' && args.pageIdOrUrl.trim() ? String(args.pageIdOrUrl) : undefined,
        caption: typeof args.caption === 'string' ? args.caption : undefined,
      },
      { sessionId: ctx.sessionId },
    );

    return {
      success: true,
      output: result,
      message: `✅ Image embedded in Notion page (${result.url})`,
    };
  },
};
