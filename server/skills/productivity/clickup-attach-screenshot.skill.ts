import type { Skill } from '../types';
import { attachFileToClickUpTask } from '../../services/clickupService';
import { getScreenshotArtifactBytesForUser, resolveRecentScreenshotArtifact } from '../../services/screenshotArtifactService';
import { findLatestArtifactTask } from '../../repositories/workspaceRepository';

function resolveClickUpTaskIdOrUrl(userId: string, sessionId?: string, explicit?: string): string {
  if (explicit?.trim()) {
    return explicit.trim();
  }

  const sessionScoped = sessionId ? findLatestArtifactTask(userId, { provider: 'clickup', sessionId }) : null;
  const globalRecent = findLatestArtifactTask(userId, { provider: 'clickup' });
  const candidate = sessionScoped?.url ?? globalRecent?.url;
  if (!candidate) {
    throw new Error('No recent ClickUp task was found. Provide a task ID or URL.');
  }

  return candidate;
}

export const clickupAttachScreenshotSkill: Skill = {
  id: 'clickup.attach-screenshot',
  name: 'Attach Screenshot To ClickUp',
  description: 'Attach the latest or a specific screenshot artifact to an existing ClickUp task.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: ['clickup'],
  triggerPhrases: [
    'Attach this screenshot to ClickUp',
    'Add the current screen to that ClickUp task',
    'Upload this screenshot to ClickUp',
  ],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      taskIdOrUrl: { type: 'string', description: 'Optional ClickUp task ID or URL. If omitted, the most recent ClickUp task is used.' },
      screenshotArtifactId: { type: 'string', description: 'Optional screenshot artifact ID. If omitted, the most recent screenshot is used.' },
    },
    required: [],
  },
  handler: async (ctx, args) => {
    const screenshot = resolveRecentScreenshotArtifact(ctx.userId, {
      artifactId: typeof args.screenshotArtifactId === 'string' && args.screenshotArtifactId.trim() ? String(args.screenshotArtifactId) : undefined,
      sessionId: ctx.sessionId,
      taskId: ctx.taskId,
    });
    if (!screenshot) {
      throw new Error('No recent screenshot artifact was found. Capture a screenshot first.');
    }

    const file = getScreenshotArtifactBytesForUser(screenshot.id, ctx.userId);
    if (!file) {
      throw new Error('The screenshot artifact could not be loaded.');
    }

    const target = resolveClickUpTaskIdOrUrl(
      ctx.userId,
      ctx.sessionId,
      typeof args.taskIdOrUrl === 'string' ? args.taskIdOrUrl : undefined,
    );
    const attachment = await attachFileToClickUpTask(ctx.workspaceId, {
      taskIdOrUrl: target,
      fileName: file.fileName,
      bytes: file.bytes,
      mimeType: file.mimeType,
    });

    return {
      success: true,
      output: {
        ...attachment,
        taskIdOrUrl: target,
        screenshot,
      },
      message: '✅ Screenshot attached to ClickUp task',
    };
  },
};
