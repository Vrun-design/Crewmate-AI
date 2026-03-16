import type { Skill } from '../types';
import { listSlackChannels } from '../../services/slackService';

export const slackListChannelsSkill: Skill = {
    id: 'slack.list-channels',
    name: 'List Slack Channels',
    description: 'List public Slack channels in the workspace. Use when the user asks what channels exist, wants to pick a channel to post to, or needs a channel ID.',
    version: '1.0.0',
    category: 'communication',
    requiresIntegration: ['slack'],
    triggerPhrases: [
        'What Slack channels are there?',
        'List Slack channels',
        'Show me the channels',
        'Which channel should I use?',
    ],
    preferredModel: 'quick',
    executionMode: 'inline',
    latencyClass: 'quick',
    sideEffectLevel: 'none',
    exposeInLiveSession: false,
    inputSchema: {
        type: 'object',
        properties: {},
    },
    handler: async (ctx) => {
        const channels = await listSlackChannels(ctx.workspaceId);
        const summary = channels.map((ch) =>
            `#${ch.name} (${ch.memberCount} members)${ch.topic ? ` — ${ch.topic}` : ''}`,
        ).join('\n');
        return {
            success: true,
            output: channels,
            message: channels.length > 0
                ? `✅ Found ${channels.length} channels:\n${summary}`
                : 'ℹ️ No public channels found.',
        };
    },
};
