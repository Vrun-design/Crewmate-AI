import { db } from '../db';
import { enqueueWorkflowRunJob } from './delegationService';
import { insertActivity } from './activityService';
import { orchestrate } from './orchestrator';
import type { JobRecord } from '../types';

export type CommandChannel = 'live_session' | 'slack' | 'email' | 'telegram' | 'webhook' | 'api';
export type CommandExecutionMode = 'sync' | 'async';

interface CommandTarget {
  userId: string;
  workspaceId: string;
}

interface CommandSource {
  channel: CommandChannel;
  senderName?: string;
  sourceRef?: string;
}

interface DispatchCommandInput {
  deliverToNotion?: boolean;
  mode?: CommandExecutionMode;
  notifyInSlack?: boolean;
  text: string;
  title?: string;
}

interface DispatchCommandResult {
  id: string;
  kind: 'agent_task' | 'job';
  message: string;
  mode: CommandExecutionMode;
  status: 'queued';
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

function getOriginType(channel: CommandChannel): JobRecord['originType'] {
  switch (channel) {
    case 'live_session':
      return 'live_session';
    case 'slack':
      return 'slack';
    case 'email':
      return 'email';
    case 'telegram':
      return 'telegram';
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
    case 'telegram':
      return 'Telegram';
    case 'api':
      return 'authenticated API';
    default:
      return 'webhook';
  }
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

  const mode = input.mode === 'async' ? 'async' : 'sync';
  const channelLabel = getChannelLabel(source.channel);

  if (mode === 'async') {
    const title = buildAsyncTitle(input.title, text, source.channel);
    const job = enqueueWorkflowRunJob(
      target.workspaceId,
      target.userId,
      {
        title,
        intent: text,
        deliverToNotion: Boolean(input.deliverToNotion),
        notifyInSlack: Boolean(input.notifyInSlack),
      },
      {
        actor: source.senderName ?? channelLabel,
        handoffSummary: `Queued from ${channelLabel}${source.senderName ? ` by ${source.senderName}` : ''}`,
        originRef: source.sourceRef ?? null,
        originType: getOriginType(source.channel),
      },
    );

    insertActivity(
      'Inbound command queued',
      `Crewmate queued background work from ${channelLabel}: "${title}".`,
      'communication',
      target.userId,
    );

    return {
      id: job.id,
      kind: 'job',
      message: `Queued background execution from ${channelLabel}.`,
      mode,
      status: 'queued',
    };
  }

  const orchestration = await orchestrate(text, {
    userId: target.userId,
    workspaceId: target.workspaceId,
  });

  insertActivity(
    'Inbound command received',
    `Crewmate started an agent task from ${channelLabel}.`,
    'communication',
    target.userId,
  );

  return {
    id: orchestration.taskId,
    kind: 'agent_task',
    message: `Started an agent task from ${channelLabel}.`,
    mode,
    status: 'queued',
  };
}
