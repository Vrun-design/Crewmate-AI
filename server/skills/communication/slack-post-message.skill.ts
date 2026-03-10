import type { Skill } from '../types';
import { postSlackMessage } from '../../services/slackService';

export const slackPostMessageSkill: Skill = {
    id: 'slack.post-message',
    name: 'Post Slack Message',
    description: 'Send a message to a Slack channel. Use when the user asks to notify the team, share an update, or send a status message.',
    version: '1.0.0',
    category: 'communication',
    personas: ['developer', 'marketer', 'founder', 'sales', 'designer'],
    requiresIntegration: ['slack'],
    triggerPhrases: [
        'Let the team know in Slack',
        'Post an update to Slack',
        'Send this to #backend',
        'Notify the team',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            text: { type: 'string', description: 'The message text to send' },
            channelId: { type: 'string', description: 'Optional Slack channel ID. Defaults to configured default channel.' },
        },
        required: ['text'],
    },
    handler: async (ctx, args) => {
        const result = await postSlackMessage(ctx.workspaceId, {
            text: String(args.text ?? ''),
            channelId: typeof args.channelId === 'string' ? args.channelId : undefined,
        });
        return {
            success: true,
            output: result,
            message: `✅ Slack message sent to channel ${result.channelId}`,
        };
    },
};
