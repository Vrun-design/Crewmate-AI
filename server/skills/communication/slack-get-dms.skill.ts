import type { Skill } from '../types';
import { getSlackDMs, listSlackDMChannels, lookupSlackUserByName } from '../../services/slackService';

export const slackGetDmsSkill: Skill = {
  id: 'slack.get-dms',
  name: 'Get Slack DMs',
  description:
    'Read recent direct messages from a Slack DM conversation with a specific user. Accepts a Slack user ID or display name. Returns the latest DM messages with sender and text.',
  version: '1.0.0',
  category: 'communication',
  requiresIntegration: ['slack'],
  triggerPhrases: [
    'Read my Slack DMs with',
    'What did [person] message me on Slack',
    'Check my Slack direct messages from',
    'Show me DMs from',
  ],
  preferredModel: 'quick',
  executionMode: 'either',
  latencyClass: 'quick',
  sideEffectLevel: 'none',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'Slack user ID (starts with U). Use this if you know the exact ID.',
      },
      userName: {
        type: 'string',
        description: 'Slack display name or @handle (e.g. "alice" or "@alice"). Will be resolved to a user ID automatically.',
      },
      limit: {
        type: 'number',
        description: 'Number of messages to fetch (default: 10, max: 50).',
      },
    },
  },
  handler: async (ctx, args) => {
    let targetUserId = typeof args.userId === 'string' ? args.userId.trim() : '';

    // Resolve name → user ID if needed
    if (!targetUserId && typeof args.userName === 'string' && args.userName.trim()) {
      targetUserId = await lookupSlackUserByName(ctx.workspaceId, args.userName.trim());
    }

    // If still no user, list available DM channels as a hint
    if (!targetUserId) {
      const dmChannels = await listSlackDMChannels(ctx.workspaceId);
      const hint = dmChannels.length > 0
        ? `Available DM user IDs: ${dmChannels.map((c) => c.userId).join(', ')}`
        : 'No open DM channels found.';
      throw new Error(`Provide a userId or userName to fetch DMs from. ${hint}`);
    }

    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 10;
    const messages = await getSlackDMs(ctx.workspaceId, targetUserId, limit);

    const summary = messages
      .map((msg, i) => `${i + 1}. [${msg.userId}]: ${msg.text}`)
      .join('\n');

    return {
      success: true,
      output: messages,
      message:
        messages.length === 0
          ? `No DM messages found with user ${targetUserId}.`
          : `Retrieved ${messages.length} DM message(s) with user ${targetUserId}:\n${summary}`,
    };
  },
};
