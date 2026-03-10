import { getEffectiveIntegrationConfig } from './integrationConfigService';
import { registerTool } from '../mcp/mcpServer';

interface PostSlackMessageInput {
  text: string;
  channelId?: string;
}

interface SlackMessageResult {
  channelId: string;
  timestamp: string;
}

function getSlackConfig(workspaceId: string) {
  const config = getEffectiveIntegrationConfig(workspaceId, 'slack');
  return {
    botToken: config.botToken ?? '',
    defaultChannelId: config.defaultChannelId ?? '',
  };
}

export function isSlackConfigured(workspaceId: string): boolean {
  const config = getSlackConfig(workspaceId);
  return Boolean(config.botToken && config.defaultChannelId);
}

export async function postSlackMessage(workspaceId: string, input: PostSlackMessageInput): Promise<SlackMessageResult> {
  const config = getSlackConfig(workspaceId);
  if (!isSlackConfigured(workspaceId)) {
    throw new Error('Slack integration is not configured. Save a bot token and default channel ID.');
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.botToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel: input.channelId ?? config.defaultChannelId,
      text: input.text,
    }),
  });

  const payload = (await response.json()) as {
    ok: boolean;
    channel?: string;
    ts?: string;
    error?: string;
  };

  if (!response.ok || !payload.ok || !payload.channel || !payload.ts) {
    throw new Error(`Slack message failed: ${payload.error ?? response.statusText}`);
  }

  return {
    channelId: payload.channel,
    timestamp: payload.ts,
  };
}

registerTool({
  name: 'post_slack_message',
  description: 'Post a message to a Slack channel when the user asks to send an update, ping the team, or share a status.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: { type: 'string' },
      channelId: { type: 'string', description: 'Optional: specify a channel ID. If omitted, uses default.' },
    },
  },
  handler: async (context, args) => {
    return postSlackMessage(context.workspaceId, {
      text: typeof args.text === 'string' ? args.text : '',
      channelId: typeof args.channelId === 'string' ? args.channelId : undefined,
    });
  },
});
