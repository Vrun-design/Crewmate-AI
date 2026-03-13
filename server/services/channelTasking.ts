import type { CommandChannel } from './commandIngressService';

export type TaskIngressMode = 'track' | 'delegate';

export interface ParsedChannelCommand {
  mode: TaskIngressMode;
  text: string;
  explicitMode: boolean;
}

export interface LiveReplyTarget {
  channel: 'live_session';
  sessionId: string;
}

export interface SlackReplyTarget {
  channel: 'slack';
  channelId: string;
  threadTs?: string | null;
  userName?: string | null;
}

export interface GenericReplyTarget {
  channel: 'app' | 'email' | 'webhook' | 'api' | 'command';
  sourceRef?: string | null;
}

export type TaskReplyTarget =
  | LiveReplyTarget
  | SlackReplyTarget
  | GenericReplyTarget;

export function buildReplyTarget(channel: CommandChannel, options: {
  sourceRef?: string;
  sessionId?: string;
  slackChannelId?: string;
  slackThreadTs?: string | null;
  userName?: string | null;
}): string | null {
  let payload: TaskReplyTarget | null = null;

  if (channel === 'live_session' && options.sessionId) {
    payload = {
      channel: 'live_session',
      sessionId: options.sessionId,
    };
  } else if (channel === 'slack' && options.slackChannelId) {
    payload = {
      channel: 'slack',
      channelId: options.slackChannelId,
      threadTs: options.slackThreadTs ?? null,
      userName: options.userName ?? null,
    };
  } else if (channel === 'email' || channel === 'webhook' || channel === 'api') {
    payload = {
      channel,
      sourceRef: options.sourceRef ?? null,
    };
  }

  return payload ? JSON.stringify(payload) : (options.sourceRef ?? null);
}

export function parseReplyTarget(originRef?: string | null): TaskReplyTarget | null {
  const value = originRef?.trim();
  if (!value) {
    return null;
  }

  if (!value.startsWith('{')) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as TaskReplyTarget;
    if (parsed && typeof parsed === 'object' && 'channel' in parsed) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export function extractLinkedSessionId(originType?: string | null, originRef?: string | null): string | null {
  if (originType !== 'live_session') {
    return null;
  }

  const structured = parseReplyTarget(originRef);
  if (structured?.channel === 'live_session') {
    return structured.sessionId;
  }

  return originRef?.trim() || null;
}

export function parseChannelModeAndText(text: string): ParsedChannelCommand {
  const trimmed = text.trim();
  if (!trimmed) {
    return { mode: 'delegate', text: '', explicitMode: false };
  }

  if (trimmed.startsWith('/track ')) {
    return { mode: 'track', text: trimmed.slice(7).trim(), explicitMode: true };
  }

  if (trimmed === '/track') {
    return { mode: 'track', text: '', explicitMode: true };
  }

  if (trimmed.startsWith('/do ')) {
    return { mode: 'delegate', text: trimmed.slice(4).trim(), explicitMode: true };
  }

  if (trimmed.startsWith('/async ')) {
    return { mode: 'delegate', text: trimmed.slice(7).trim(), explicitMode: true };
  }

  if (trimmed.startsWith('/later ')) {
    return { mode: 'delegate', text: trimmed.slice(7).trim(), explicitMode: true };
  }

  return { mode: 'delegate', text: trimmed, explicitMode: false };
}

const CASUAL_CHAT_PATTERNS = new Set([
  'hi',
  'hii',
  'hiii',
  'hello',
  'hey',
  'heyy',
  'yo',
  'sup',
  'gm',
  'gn',
  'good morning',
  'good night',
  'thanks',
  'thank you',
  'ok',
  'okay',
  'cool',
  'nice',
]);

export function looksLikeCasualChat(text: string): boolean {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) {
    return true;
  }

  if (CASUAL_CHAT_PATTERNS.has(normalized)) {
    return true;
  }

  return normalized.length <= 12 && /^[a-z!?., ]+$/.test(normalized);
}
