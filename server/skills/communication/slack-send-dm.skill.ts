import type { Skill } from '../types';
import { sendSlackDM, lookupSlackUserByName } from '../../services/slackService';

export const slackSendDmSkill: Skill = {
  id: 'slack.send-dm',
  name: 'Send Slack Direct Message',
  description: 'Send a direct message to a Slack user. Accepts either a userId (starts with U) or a recipientName (display name or @handle). Resolves the name to a user ID automatically.',
  version: '1.0.0',
  category: 'communication',
  requiresIntegration: ['slack'],
  triggerPhrases: [
    'DM John on Slack',
    'Send a direct message to @sarah',
    'Message Alex privately on Slack',
    'Slack DM the team lead',
  ],
  preferredModel: 'quick',
  executionMode: 'either',
  latencyClass: 'quick',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The message to send.' },
      recipientId: { type: 'string', description: 'Slack user ID (starts with U). Use if you know the exact user ID.' },
      recipientName: { type: 'string', description: 'Slack display name or @handle (e.g. "john.smith" or "@sarah"). Will be resolved to user ID automatically.' },
    },
    required: ['text'],
  },
  handler: async (ctx, args) => {
    const text = String(args.text ?? '');
    let recipientId = typeof args.recipientId === 'string' ? args.recipientId.trim() : '';

    if (!recipientId && typeof args.recipientName === 'string' && args.recipientName.trim()) {
      recipientId = await lookupSlackUserByName(ctx.workspaceId, args.recipientName.trim());
    }

    if (!recipientId) {
      throw new Error('Provide a recipientId or recipientName to send a DM.');
    }

    const result = await sendSlackDM(ctx.workspaceId, recipientId, text);
    return {
      success: true,
      output: result,
      message: `✅ Slack DM sent to user ${recipientId} — message timestamp: ${result.timestamp}`,
    };
  },
};
