import { db } from '../db';
import { insertActivity } from './activityService';
import { orchestrate } from './orchestrator';
import { createWorkspaceTask } from '../repositories/workspaceRepository';
import { buildReplyTarget, type TaskIngressMode } from './channelTasking';

export type CommandChannel = 'live_session' | 'slack' | 'email' | 'webhook' | 'api';

interface CommandTarget {
  userId: string;
  workspaceId: string;
}

interface CommandSource {
  channel: CommandChannel;
  senderName?: string;
  sourceRef?: string;
  sessionId?: string;
  slackChannelId?: string;
  slackThreadTs?: string | null;
}

interface DispatchCommandInput {
  deliverToNotion?: boolean;
  mode?: TaskIngressMode | 'sync' | 'async';
  notifyInSlack?: boolean;
  text: string;
  title?: string;
}

interface DispatchCommandResult {
  id: string;
  kind: 'agent_task' | 'task';
  message: string;
  mode: TaskIngressMode;
  status: 'queued' | 'pending';
}

interface WorkspaceMemberRow {
  userId: string;
  workspaceId: string;
}

function buildAsyncTitle(title: string | undefined, text: string, channel: CommandChannel): string {
  if (title?.trim()) {
    return title.trim();
  }

  const normalized = text.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return `Queued ${channel} command`;
  }

  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

function getOriginType(channel: CommandChannel): 'live_session' | 'slack' | 'email' | 'system' {
  switch (channel) {
    case 'live_session':
      return 'live_session';
    case 'slack':
      return 'slack';
    case 'email':
      return 'email';
    default:
      return 'system';
  }
}

function getChannelLabel(channel: CommandChannel): string {
  switch (channel) {
    case 'live_session':
      return 'live session';
    case 'slack':
      return 'Slack';
    case 'email':
      return 'email';
    case 'api':
      return 'authenticated API';
    default:
      return 'webhook';
  }
}

function normalizeMode(mode?: DispatchCommandInput['mode']): TaskIngressMode {
  if (mode === 'track') {
    return 'track';
  }

  return 'delegate';
}

export function findCommandTargetByEmail(email: string): CommandTarget | null {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const row = db.prepare(`
    SELECT u.id as userId, wm.workspace_id as workspaceId
    FROM users u
    INNER JOIN workspace_members wm ON wm.user_id = u.id
    WHERE u.email = ?
    LIMIT 1
  `).get(normalizedEmail) as WorkspaceMemberRow | undefined;

  if (!row) {
    return null;
  }

  return {
    userId: row.userId,
    workspaceId: row.workspaceId,
  };
}

export function findCommandTargetByWorkspaceId(workspaceId: string): CommandTarget | null {
  const row = db.prepare(`
    SELECT wm.user_id as userId, wm.workspace_id as workspaceId
    FROM workspace_members wm
    WHERE wm.workspace_id = ?
    ORDER BY CASE WHEN wm.role = 'owner' THEN 0 ELSE 1 END, wm.joined_at ASC
    LIMIT 1
  `).get(workspaceId) as WorkspaceMemberRow | undefined;

  if (!row) {
    return null;
  }

  return {
    userId: row.userId,
    workspaceId: row.workspaceId,
  };
}

export async function dispatchCommand(
  target: CommandTarget,
  source: CommandSource,
  input: DispatchCommandInput,
): Promise<DispatchCommandResult> {
  const text = input.text.trim();
  if (!text) {
    throw new Error('text is required');
  }

  const mode = normalizeMode(input.mode);
  const channelLabel = getChannelLabel(source.channel);
  const originType = getOriginType(source.channel);
  const originRef = buildReplyTarget(source.channel, {
    sourceRef: source.sourceRef,
    sessionId: source.sessionId,
    slackChannelId: source.slackChannelId,
    slackThreadTs: source.slackThreadTs,
    userName: source.senderName,
  });

  if (mode === 'track') {
    const title = buildAsyncTitle(input.title, text, source.channel);
    const task = createWorkspaceTask(target.userId, {
      title,
      description: text,
      tool: channelLabel,
      priority: 'Medium',
      status: 'pending',
      sourceKind: 'integration',
    });

    insertActivity(
      'Inbound task tracked',
      `Crewmate tracked work from ${channelLabel}: "${title}".`,
      'communication',
      target.userId,
    );

    return {
      id: task.id,
      kind: 'task',
      message: `Task tracked from ${channelLabel}.`,
      mode,
      status: 'pending',
    };
  }

  if (mode === 'delegate') {
    const title = buildAsyncTitle(input.title, text, source.channel);
    const orchestration = await orchestrate(text, {
      userId: target.userId,
      workspaceId: target.workspaceId,
      originType,
      originRef: originRef ?? null,
      taskTitle: title,
    });

    insertActivity(
      'Inbound task started',
      `Crewmate started a task from ${channelLabel}: "${title}".`,
      'communication',
      target.userId,
    );

    return {
      id: orchestration.taskId,
      kind: 'agent_task',
      message: `Task started from ${channelLabel}.`,
      mode,
      status: 'queued',
    };
  }
}
