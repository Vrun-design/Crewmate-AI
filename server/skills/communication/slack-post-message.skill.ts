import type { Skill } from '../types';
import { postSlackMessage } from '../../services/slackService';

export const slackPostMessageSkill: Skill = {
  id: 'slack.post-message',
  name: 'Post Slack Message',
  description: 'Send a message to a Slack channel. Accepts either a channelId or a channelName (e.g. "engineering" or "#general"). If neither is provided, uses the configured default channel.',
  version: '1.1.0',
  category: 'communication',
  requiresIntegration: ['slack'],
  triggerPhrases: [
    'Let the team know in Slack',
    'Post an update to Slack',
    'Send this to #backend',
    'Notify the team',
    'Post to the engineering channel',
  ],
  preferredModel: 'quick',
  executionMode: 'either',
  latencyClass: 'quick',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The full message text to post. You must compose this yourself based on the context — e.g. include the Notion link, task name, or summary being shared. Never leave this empty.' },
      channelId: { type: 'string', description: 'Optional Slack channel ID (starts with C). Use this if you know the exact ID.' },
      channelName: { type: 'string', description: 'Optional Slack channel name (e.g. "engineering" or "#general"). Will be resolved to an ID automatically.' },
    },
    required: ['text'],
  },
  handler: async (ctx, args) => {
    const text = String(args.text ?? '').trim() || ctx.taskTitle?.trim() || '';
    if (!text) {
      throw new Error('Message text is required to post a Slack message.');
    }
    const result = await postSlackMessage(ctx.workspaceId, {
      text,
      channelId: typeof args.channelId === 'string' ? args.channelId : undefined,
      channelName: typeof args.channelName === 'string' ? args.channelName : undefined,
    });
    return {
      success: true,
      output: result,
      message: `✅ Slack message posted to channel ${result.channelId} — message timestamp: ${result.timestamp}`,
    };
  },
};
