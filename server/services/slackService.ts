import {getEffectiveIntegrationConfig} from './integrationConfigService';

interface PostSlackMessageInput {
  text: string;
  channelId?: string;
}

interface SlackMessageResult {
  channelId: string;
  timestamp: string;
}

function getSlackConfig(userId: string) {
  const config = getEffectiveIntegrationConfig(userId, 'slack');
  return {
    botToken: config.botToken ?? '',
    defaultChannelId: config.defaultChannelId ?? '',
  };
}

export function isSlackConfigured(userId: string): boolean {
  const config = getSlackConfig(userId);
  return Boolean(config.botToken && config.defaultChannelId);
}

export async function postSlackMessage(userId: string, input: PostSlackMessageInput): Promise<SlackMessageResult> {
  const config = getSlackConfig(userId);
  if (!isSlackConfigured(userId)) {
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
