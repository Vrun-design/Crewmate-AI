import type { Skill } from '../types';
import { getEffectiveIntegrationConfig } from '../../services/integrationConfigService';

interface SlackChannel {
    id: string;
    name: string;
    topic: string;
    memberCount: number;
}

async function listSlackChannels(workspaceId: string): Promise<SlackChannel[]> {
    const config = getEffectiveIntegrationConfig(workspaceId, 'slack');
    const botToken = config.botToken ?? '';

    if (!botToken) {
        throw new Error('Slack integration is not configured. Save a bot token.');
    }

    const response = await fetch(
        'https://slack.com/api/conversations.list?limit=50&exclude_archived=true&types=public_channel',
        {
            headers: {
                Authorization: `Bearer ${botToken}`,
                'Content-Type': 'application/json',
            },
        },
    );

    const payload = await response.json() as {
        ok: boolean;
        channels?: Array<{
            id: string;
            name: string;
            topic: { value: string };
            num_members: number;
        }>;
        error?: string;
    };

    if (!payload.ok) {
        throw new Error(`Slack list channels failed: ${payload.error ?? 'unknown error'}`);
    }

    return (payload.channels ?? []).map((ch) => ({
        id: ch.id,
        name: ch.name,
        topic: ch.topic?.value ?? '',
        memberCount: ch.num_members ?? 0,
    }));
}

export const slackListChannelsSkill: Skill = {
    id: 'slack.list-channels',
    name: 'List Slack Channels',
    description: 'List public Slack channels in the workspace. Use when the user asks what channels exist, wants to pick a channel to post to, or needs a channel ID.',
    version: '1.0.0',
    category: 'communication',
    personas: ['developer', 'marketer', 'founder', 'sales', 'designer'],
    requiresIntegration: ['slack'],
    triggerPhrases: [
        'What Slack channels are there?',
        'List Slack channels',
        'Show me the channels',
        'Which channel should I use?',
    ],
    preferredModel: 'quick',
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
