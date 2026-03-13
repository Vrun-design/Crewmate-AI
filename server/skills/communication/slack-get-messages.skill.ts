import type { Skill } from '../types';
import { getSlackMessages, resolveSlackChannelName } from '../../services/slackService';

export const slackGetMessagesSkill: Skill = {
  id: 'slack.get-messages',
  name: 'Get Slack Messages',
  description: 'Read the most recent messages from a Slack channel. Accepts a channel name (e.g. "engineering") or channel ID. Returns the latest messages with sender and text.',
  version: '1.0.0',
  category: 'communication',
  requiresIntegration: ['slack'],
  triggerPhrases: [
    'What was said in #engineering',
    'Read the last messages from Slack',
    'Check Slack channel messages',
    'What is the latest on #general',
  ],
  preferredModel: 'quick',
  executionMode: 'either',
  latencyClass: 'quick',
  sideEffectLevel: 'low',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      channelId: { type: 'string', description: 'Slack channel ID (starts with C). Use this if you know the exact ID.' },
      channelName: { type: 'string', description: 'Channel name (e.g. "engineering" or "#general"). Will be resolved to ID automatically.' },
      limit: { type: 'number', description: 'Number of messages to fetch (default: 10, max: 50).' },
    },
  },
  handler: async (ctx, args) => {
    let channelId = typeof args.channelId === 'string' ? args.channelId.trim() : '';
    if (!channelId && typeof args.channelName === 'string') {
      channelId = await resolveSlackChannelName(ctx.workspaceId, args.channelName);
    }
    if (!channelId) {
      throw new Error('Provide a channelId or channelName (e.g. "engineering") to fetch messages from.');
    }

    const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 10;
    const messages = await getSlackMessages(ctx.workspaceId, channelId, limit);
    const summary = messages.map((message, index) => `${index + 1}. [${message.userId}]: ${message.text}`).join('\n');

    return {
      success: true,
      output: messages,
      message: messages.length === 0
        ? `No messages found in channel ${channelId}.`
        : `Retrieved ${messages.length} message(s) from channel ${channelId}:\n${summary}`,
    };
  },
};
