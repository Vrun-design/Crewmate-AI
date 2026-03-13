import type { Skill } from '../types';
import { captureLatestLiveScreenshot } from '../../services/screenshotArtifactService';

export const liveCaptureScreenshotSkill: Skill = {
  id: 'live.capture-screenshot',
  name: 'Capture Live Screenshot',
  description: 'Capture the latest shared-screen frame from the active live session and save it as a durable screenshot artifact.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: [],
  triggerPhrases: [
    'Capture a screenshot',
    'Save this screen',
    'Take a screenshot of what I am sharing',
  ],
  preferredModel: 'quick',
  executionMode: 'inline',
  latencyClass: 'quick',
  sideEffectLevel: 'low',
  exposeInLiveSession: true,
  usageExamples: [
    'Capture a screenshot of this error state',
    'Save the screen I am sharing',
    'Take a screenshot for the current task',
  ],
  invokingMessage: 'Capturing the latest shared screen frame.',
  invokedMessage: 'Live screenshot captured.',
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Optional short title for the screenshot artifact.' },
      caption: { type: 'string', description: 'Optional descriptive caption for the screenshot artifact.' },
    },
    required: [],
  },
  handler: async (ctx, args) => {
    if (!ctx.sessionId) {
      throw new Error('A live session is required to capture a screenshot.');
    }

    const artifact = captureLatestLiveScreenshot({
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      sessionId: ctx.sessionId,
      taskId: ctx.taskId,
      title: typeof args.title === 'string' ? args.title : undefined,
      caption: typeof args.caption === 'string' ? args.caption : undefined,
    });

    return {
      success: true,
      output: artifact,
      message: `✅ Screenshot captured (${artifact.publicUrl})`,
    };
  },
};
