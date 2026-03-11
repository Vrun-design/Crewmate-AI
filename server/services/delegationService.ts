import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { serverConfig } from '../config';
import { listActivities, listSessionHistory, listTasks } from '../repositories/workspaceRepository';
import { insertActivity, insertTask } from './activityService';
import { createNotionPage, isNotionConfigured } from './notionService';
import { postSlackMessage, isSlackConfigured } from './slackService';
import { isTelegramConfigured, postTelegramMessage } from './telegramService';
import { broadcastEvent } from './eventService';
import { getTask, orchestrate } from './orchestrator';
import type { JobRecord, WorkArtifactRecord, WorkDeliveryRecord, WorkHandoffRecord } from '../types';
import { listNotifications } from './notificationService';

interface ResearchBriefPayload {
  topic: string;
  goal: string;
  audience: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
}

interface DailyDigestPayload {
  audience: string;
  timeWindowLabel: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
}

interface WorkflowRunPayload {
  title: string;
  intent: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
}

interface JobQueueMetadata {
  actor?: string;
  handoffSummary?: string;
  originRef?: string | null;
  originType?: JobRecord['originType'];
}

interface StoredJobRow {
  id: string;
  workspaceId: string;
  type: JobRecord['type'];
  status: JobRecord['status'];
  title: string;
  payloadJson: string;
  resultJson?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  originType?: string | null;
  originRef?: string | null;
  deliveryChannelsJson?: string | null;
  artifactRefsJson?: string | null;
  approvalStatus?: string | null;
  approvalRequestedAt?: string | null;
  approvedAt?: string | null;
  handoffLogJson?: string | null;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapJob(row: StoredJobRow): JobRecord {
  const payload = row.type === 'daily_digest'
    ? parseJson<DailyDigestPayload>(row.payloadJson, {
      audience: 'team',
      timeWindowLabel: 'Daily',
      deliverToNotion: false,
      notifyInSlack: false,
    })
    : row.type === 'workflow_run'
      ? parseJson<WorkflowRunPayload>(row.payloadJson, {
        title: row.title,
        intent: row.title,
        deliverToNotion: false,
        notifyInSlack: false,
      })
    : parseJson<ResearchBriefPayload>(row.payloadJson, {
      topic: row.title,
      goal: '',
      audience: 'team',
      deliverToNotion: false,
      notifyInSlack: false,
    });
  const result = parseJson<{ summary?: string }>(row.resultJson, {});
  const deliveryChannels = parseJson<WorkDeliveryRecord[]>(row.deliveryChannelsJson, []);
  const artifactRefs = parseJson<WorkArtifactRecord[]>(row.artifactRefsJson, []);
  const handoffLog = parseJson<WorkHandoffRecord[]>(row.handoffLogJson, []);

  return {
    id: row.id,
    type: row.type,
    status: row.status,
    title: row.title,
    summary: result.summary
      ?? ('goal' in payload
        ? payload.goal
        : 'audience' in payload
          ? `Summarize recent work for ${payload.audience}`
          : payload.intent)
      ?? 'Delegated async job',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt ?? null,
    originType: (row.originType as JobRecord['originType']) ?? 'delegation',
    originRef: row.originRef ?? null,
    deliveryChannels,
    artifactRefs,
    approvalStatus: (row.approvalStatus as JobRecord['approvalStatus']) ?? 'not_required',
    approvalRequestedAt: row.approvalRequestedAt ?? null,
    approvedAt: row.approvedAt ?? null,
    handoffLog,
  };
}

export function listJobs(userId: string): JobRecord[] {
  const rows = db.prepare(`
    SELECT
      id,
      workspace_id as workspaceId,
      type,
      status,
      title,
      payload_json as payloadJson,
      result_json as resultJson,
      error_message as errorMessage,
      created_at as createdAt,
      updated_at as updatedAt,
      completed_at as completedAt,
      origin_type as originType,
      origin_ref as originRef,
      delivery_channels_json as deliveryChannelsJson,
      artifact_refs_json as artifactRefsJson,
      approval_status as approvalStatus,
      approval_requested_at as approvalRequestedAt,
      approved_at as approvedAt,
      handoff_log_json as handoffLogJson
    FROM jobs
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId) as StoredJobRow[];

  return rows.map(mapJob);
}

export function enqueueResearchBriefJob(
  workspaceId: string,
  userId: string,
  payload: ResearchBriefPayload,
  metadata?: JobQueueMetadata,
): JobRecord {
  const now = new Date().toISOString();
  const id = `JOB-${randomUUID()}`;
  const title = payload.topic.trim() || 'Async research brief';
  const originType = metadata?.originType ?? 'delegation';
  const originRef = metadata?.originRef ?? null;
  const actor = metadata?.actor ?? 'user';
  const handoffSummary = metadata?.handoffSummary ?? 'Queued from Delegations page';

  db.prepare(`
    INSERT INTO jobs (
      id,
      workspace_id,
      user_id,
      type,
      status,
      title,
      payload_json,
      result_json,
      error_message,
      origin_type,
      origin_ref,
      delivery_channels_json,
      artifact_refs_json,
      approval_status,
      approval_requested_at,
      approved_at,
      handoff_log_json,
      created_at,
      updated_at,
      started_at,
      completed_at
    ) VALUES (?, ?, ?, 'research_brief', 'queued', ?, ?, NULL, NULL, ?, ?, '[]', '[]', 'not_required', NULL, NULL, ?, ?, ?, NULL, NULL)
  `).run(
    id,
    workspaceId,
    userId,
    title,
    JSON.stringify(payload),
    originType,
    originRef,
    JSON.stringify([{ at: now, type: 'created', actor, summary: handoffSummary } satisfies WorkHandoffRecord]),
    now,
    now,
  );

  insertTask(`Queued delegated research: ${title}`, 'Crewmate');
  insertActivity(
    'Delegated async job queued',
    `Crewmate queued a background research brief for "${title}".`,
    'research',
  );

  broadcastEvent(userId, 'job_update', { jobId: id, status: 'queued' });

  return {
    id,
    type: 'research_brief',
    status: 'queued',
    title,
    summary: payload.goal,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    originType,
    originRef,
    deliveryChannels: [],
    artifactRefs: [],
    approvalStatus: 'not_required',
    approvalRequestedAt: null,
    approvedAt: null,
    handoffLog: [{ at: now, type: 'created', actor, summary: handoffSummary }],
  };
}

export function enqueueDailyDigestJob(
  workspaceId: string,
  userId: string,
  payload: DailyDigestPayload,
  metadata?: JobQueueMetadata,
): JobRecord {
  const now = new Date().toISOString();
  const id = `JOB-${randomUUID()}`;
  const title = `${payload.timeWindowLabel} digest`;
  const originType = metadata?.originType ?? 'delegation';
  const originRef = metadata?.originRef ?? null;
  const actor = metadata?.actor ?? 'user';
  const handoffSummary = metadata?.handoffSummary ?? 'Queued a daily digest from Delegations';

  db.prepare(`
    INSERT INTO jobs (
      id,
      workspace_id,
      user_id,
      type,
      status,
      title,
      payload_json,
      result_json,
      error_message,
      origin_type,
      origin_ref,
      delivery_channels_json,
      artifact_refs_json,
      approval_status,
      approval_requested_at,
      approved_at,
      handoff_log_json,
      created_at,
      updated_at,
      started_at,
      completed_at
    ) VALUES (?, ?, ?, 'daily_digest', 'queued', ?, ?, NULL, NULL, ?, ?, '[]', '[]', 'not_required', NULL, NULL, ?, ?, ?, NULL, NULL)
  `).run(
    id,
    workspaceId,
    userId,
    title,
    JSON.stringify(payload),
    originType,
    originRef,
    JSON.stringify([{ at: now, type: 'created', actor, summary: handoffSummary } satisfies WorkHandoffRecord]),
    now,
    now,
  );

  insertTask(`Queued off-shift digest: ${title}`, 'Crewmate', 'completed', userId);
  insertActivity(
    'Delegated daily digest queued',
    `Crewmate queued a ${payload.timeWindowLabel.toLowerCase()} digest for ${payload.audience}.`,
    'research',
    userId,
  );

  broadcastEvent(userId, 'job_update', { jobId: id, status: 'queued' });

  return {
    id,
    type: 'daily_digest',
    status: 'queued',
    title,
    summary: `Summarize recent sessions, activity, tasks, and notifications for ${payload.audience}.`,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    originType,
    originRef,
    deliveryChannels: [],
    artifactRefs: [],
    approvalStatus: 'not_required',
    approvalRequestedAt: null,
    approvedAt: null,
    handoffLog: [{ at: now, type: 'created', actor, summary: handoffSummary }],
  };
}

export function enqueueWorkflowRunJob(
  workspaceId: string,
  userId: string,
  payload: WorkflowRunPayload,
  metadata?: JobQueueMetadata,
): JobRecord {
  const now = new Date().toISOString();
  const id = `JOB-${randomUUID()}`;
  const title = payload.title.trim() || 'Off-shift workflow';
  const originType = metadata?.originType ?? 'delegation';
  const originRef = metadata?.originRef ?? null;
  const actor = metadata?.actor ?? 'user';
  const handoffSummary = metadata?.handoffSummary ?? 'Queued a generic off-shift workflow';

  db.prepare(`
    INSERT INTO jobs (
      id,
      workspace_id,
      user_id,
      type,
      status,
      title,
      payload_json,
      result_json,
      error_message,
      origin_type,
      origin_ref,
      delivery_channels_json,
      artifact_refs_json,
      approval_status,
      approval_requested_at,
      approved_at,
      handoff_log_json,
      created_at,
      updated_at,
      started_at,
      completed_at
    ) VALUES (?, ?, ?, 'workflow_run', 'queued', ?, ?, NULL, NULL, ?, ?, '[]', '[]', 'not_required', NULL, NULL, ?, ?, ?, NULL, NULL)
  `).run(
    id,
    workspaceId,
    userId,
    title,
    JSON.stringify(payload),
    originType,
    originRef,
    JSON.stringify([{ at: now, type: 'created', actor, summary: handoffSummary } satisfies WorkHandoffRecord]),
    now,
    now,
  );

  insertTask(`Queued off-shift workflow: ${title}`, 'Crewmate', 'completed', userId);
  insertActivity(
    'Delegated workflow queued',
    `Crewmate queued "${title}" for off-shift execution.`,
    'research',
    userId,
  );

  broadcastEvent(userId, 'job_update', { jobId: id, status: 'queued' });

  return {
    id,
    type: 'workflow_run',
    status: 'queued',
    title,
    summary: payload.intent,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    originType,
    originRef,
    deliveryChannels: [],
    artifactRefs: [],
    approvalStatus: 'not_required',
    approvalRequestedAt: null,
    approvedAt: null,
    handoffLog: [{ at: now, type: 'created', actor, summary: handoffSummary }],
  };
}

function getNextQueuedJob(): {
  id: string;
  workspaceId: string;
  userId: string;
  type: JobRecord['type'];
  payload: ResearchBriefPayload | DailyDigestPayload | WorkflowRunPayload;
  title: string;
  deliveryChannels: WorkDeliveryRecord[];
  artifactRefs: WorkArtifactRecord[];
  handoffLog: WorkHandoffRecord[];
} | null {
  const row = db.prepare(`
    SELECT
      id,
      workspace_id as workspaceId,
      user_id as userId,
      type,
      title,
      payload_json as payloadJson,
      delivery_channels_json as deliveryChannelsJson,
      artifact_refs_json as artifactRefsJson,
      handoff_log_json as handoffLogJson
    FROM jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
  `).get() as {
    id: string;
    workspaceId: string;
    userId: string;
    type: JobRecord['type'];
    title: string;
    payloadJson: string;
    deliveryChannelsJson?: string | null;
    artifactRefsJson?: string | null;
    handoffLogJson?: string | null;
  } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    type: row.type,
    title: row.title,
    payload: row.type === 'daily_digest'
      ? parseJson<DailyDigestPayload>(row.payloadJson, {
        audience: 'team',
        timeWindowLabel: 'Daily',
        deliverToNotion: false,
        notifyInSlack: false,
      })
      : row.type === 'workflow_run'
        ? parseJson<WorkflowRunPayload>(row.payloadJson, {
          title: row.title,
          intent: row.title,
          deliverToNotion: false,
          notifyInSlack: false,
        })
      : parseJson<ResearchBriefPayload>(row.payloadJson, {
        topic: row.title,
        goal: '',
        audience: 'team',
        deliverToNotion: false,
        notifyInSlack: false,
      }),
    deliveryChannels: parseJson<WorkDeliveryRecord[]>(row.deliveryChannelsJson, []),
    artifactRefs: parseJson<WorkArtifactRecord[]>(row.artifactRefsJson, []),
    handoffLog: parseJson<WorkHandoffRecord[]>(row.handoffLogJson, []),
  };
}

function formatWorkflowResult(result: unknown): string {
  if (typeof result === 'string') {
    return result;
  }

  if (result && typeof result === 'object') {
    const payload = result as Record<string, unknown>;
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
    if (typeof payload.summary === 'string' && payload.summary.trim()) {
      return payload.summary;
    }
    if (typeof payload.output === 'string' && payload.output.trim()) {
      return payload.output;
    }

    return JSON.stringify(payload, null, 2);
  }

  return String(result);
}

async function waitForAgentTask(taskId: string, userId: string): Promise<ReturnType<typeof getTask>> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 120000) {
    const task = getTask(taskId, userId);
    if (task?.status === 'completed' || task?.status === 'failed') {
      return task;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Workflow handoff timed out while waiting for the agent task to finish.');
}

function buildDigestBody(input: {
  title: string;
  audience: string;
  sessions: ReturnType<typeof listSessionHistory>;
  tasks: ReturnType<typeof listTasks>;
  activities: ReturnType<typeof listActivities>;
  notifications: ReturnType<typeof listNotifications>;
}): { summary: string; body: string } {
  const topActivities = input.activities.slice(0, 3).map((activity) => `- ${activity.title}: ${activity.description}`);
  const topTasks = input.tasks.slice(0, 3).map((task) => `- ${task.title} [${task.status}] via ${task.tool}`);
  const topSessions = input.sessions.slice(0, 2).map((session) => `- ${session.title} (${session.duration}, ${session.tasks} user turns)`);
  const unreadNotifications = input.notifications.filter((notification) => !notification.read);

  const summary = [
    `${input.sessions.length} sessions reviewed`,
    `${input.tasks.length} tracked tasks`,
    `${input.activities.length} activity events`,
    `${unreadNotifications.length} unread notifications`,
  ].join(' · ');

  const body = [
    `# ${input.title}`,
    '',
    `Audience: ${input.audience}`,
    `Snapshot: ${summary}`,
    '',
    '## Live sessions',
    ...(topSessions.length > 0 ? topSessions : ['- No recent sessions recorded']),
    '',
    '## Task movement',
    ...(topTasks.length > 0 ? topTasks : ['- No recent tasks recorded']),
    '',
    '## Key activity',
    ...(topActivities.length > 0 ? topActivities : ['- No recent activity recorded']),
    '',
    '## Notifications',
    unreadNotifications.length > 0
      ? `Unread alerts: ${unreadNotifications.slice(0, 5).map((notification) => notification.title).join(', ')}`
      : 'No unread alerts right now.',
  ].join('\n');

  return { summary, body };
}

function markJobRunning(jobId: string, userId: string): void {
  const now = new Date().toISOString();
  const row = db.prepare('SELECT handoff_log_json as handoffLogJson FROM jobs WHERE id = ?').get(jobId) as { handoffLogJson?: string | null } | undefined;
  const handoffLog = parseJson<WorkHandoffRecord[]>(row?.handoffLogJson, []);
  handoffLog.push({ at: now, type: 'started', actor: 'system', summary: 'Background execution started' });

  db.prepare(`
    UPDATE jobs
    SET status = 'running', started_at = ?, updated_at = ?, handoff_log_json = ?
    WHERE id = ?
  `).run(now, now, JSON.stringify(handoffLog), jobId);

  broadcastEvent(userId, 'job_update', { jobId, status: 'running' });
}

function markJobFinished(
  jobId: string,
  userId: string,
  status: 'completed' | 'failed',
  result: unknown,
  options?: {
    errorMessage?: string;
    deliveryChannels?: WorkDeliveryRecord[];
    artifactRefs?: WorkArtifactRecord[];
    handoffLogEntry?: WorkHandoffRecord;
  },
): void {
  const now = new Date().toISOString();
  const row = db.prepare(`
    SELECT
      handoff_log_json as handoffLogJson,
      delivery_channels_json as deliveryChannelsJson,
      artifact_refs_json as artifactRefsJson
    FROM jobs
    WHERE id = ?
  `).get(jobId) as {
    handoffLogJson?: string | null;
    deliveryChannelsJson?: string | null;
    artifactRefsJson?: string | null;
  } | undefined;
  const handoffLog = parseJson<WorkHandoffRecord[]>(row?.handoffLogJson, []);
  handoffLog.push(
    options?.handoffLogEntry ?? {
      at: now,
      type: status === 'completed' ? 'delivered' : 'failed',
      actor: 'system',
      summary: status === 'completed' ? 'Background execution completed' : 'Background execution failed',
    },
  );
  const deliveryChannels = options?.deliveryChannels ?? parseJson<WorkDeliveryRecord[]>(row?.deliveryChannelsJson, []);
  const artifactRefs = options?.artifactRefs ?? parseJson<WorkArtifactRecord[]>(row?.artifactRefsJson, []);

  db.prepare(`
    UPDATE jobs
    SET status = ?, result_json = ?, error_message = ?, updated_at = ?, completed_at = ?, delivery_channels_json = ?, artifact_refs_json = ?, handoff_log_json = ?
    WHERE id = ?
  `).run(
    status,
    JSON.stringify(result),
    options?.errorMessage ?? null,
    now,
    now,
    JSON.stringify(deliveryChannels),
    JSON.stringify(artifactRefs),
    JSON.stringify(handoffLog),
    jobId,
  );

  broadcastEvent(userId, 'job_update', { jobId, status });
}

async function maybeSendTelegramJobUpdate(
  workspaceId: string,
  payload: {
    artifactUrl?: string | null;
    jobId: string;
    status: 'completed' | 'failed';
    summary: string;
    title: string;
  },
): Promise<void> {
  if (!isTelegramConfigured(workspaceId)) {
    return;
  }

  const statusLabel = payload.status === 'completed' ? 'completed' : 'failed';
  const lines = [
    `Crewmate background job ${statusLabel}`,
    payload.title,
    payload.summary,
  ];

  if (payload.artifactUrl) {
    lines.push(`Artifact: ${payload.artifactUrl}`);
  }

  lines.push(`Job ID: ${payload.jobId}`);
  await postTelegramMessage(workspaceId, { text: lines.join('\n') });
}

async function runResearchBriefJob(job: {
  id: string;
  workspaceId: string;
  userId: string;
  payload: ResearchBriefPayload;
  title: string;
  deliveryChannels: WorkDeliveryRecord[];
  artifactRefs: WorkArtifactRecord[];
  handoffLog: WorkHandoffRecord[];
}): Promise<void> {
  const agentUrl = `http://localhost:${serverConfig.port + 1}/api/v1/research`;
  const response = await fetch(agentUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(job.payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Research Agent failed: ${response.status} ${text}`);
  }

  const { data } = await response.json() as {
    data: { plan: string; findings: string; brief: string; }
  };
  const { plan, findings, brief } = data;

  const deliveryChannels: WorkDeliveryRecord[] = [];
  const artifactRefs: WorkArtifactRecord[] = [
    { kind: 'brief', label: `${job.title} brief` },
    { kind: 'summary', label: `${job.title} findings summary` },
  ];
  let notionUrl: string | null = null;
  if (job.payload.deliverToNotion && isNotionConfigured(job.workspaceId)) {
    const notionResult = await createNotionPage(job.workspaceId, {
      title: `${job.title} Brief`,
      content: brief,
    });
    notionUrl = notionResult.url;
    deliveryChannels.push({
      channel: 'notion',
      destinationLabel: 'Notion workspace',
      deliveredAt: new Date().toISOString(),
      status: 'delivered',
    });
    artifactRefs.push({ kind: 'notion_page', label: `${job.title} Notion page`, url: notionUrl });
  }

  if (job.payload.notifyInSlack && isSlackConfigured(job.workspaceId)) {
    await postSlackMessage(job.workspaceId, {
      text: `Crewmate completed the delegated brief for "${job.title}".${notionUrl ? ` Notion: ${notionUrl}` : ''}`,
    });
    deliveryChannels.push({
      channel: 'slack',
      destinationLabel: 'Slack default channel',
      deliveredAt: new Date().toISOString(),
      status: 'delivered',
    });
  }

  markJobFinished(
    job.id,
    job.userId,
    'completed',
    {
      summary: job.payload.goal,
      plan,
      findings,
      brief,
      notionUrl,
    },
    {
      deliveryChannels,
      artifactRefs,
      handoffLogEntry: {
        at: new Date().toISOString(),
        type: 'delivered',
        actor: 'system',
        summary: notionUrl ? 'Delivered final brief to Notion and optional Slack update' : 'Completed delegated brief',
      },
    },
  );

  insertTask(`Completed delegated research: ${job.title}`, 'Crewmate');
  insertActivity(
    'Delegated async job completed',
    notionUrl
      ? `Finished the background brief for "${job.title}" and published it to Notion.`
      : `Finished the background brief for "${job.title}".`,
    'research',
  );

  await maybeSendTelegramJobUpdate(job.workspaceId, {
    artifactUrl: notionUrl,
    jobId: job.id,
    status: 'completed',
    summary: job.payload.goal,
    title: job.title,
  });
}

async function runDailyDigestJob(job: {
  id: string;
  workspaceId: string;
  userId: string;
  payload: DailyDigestPayload;
  title: string;
  deliveryChannels: WorkDeliveryRecord[];
  artifactRefs: WorkArtifactRecord[];
  handoffLog: WorkHandoffRecord[];
}): Promise<void> {
  const sessions = listSessionHistory(job.userId);
  const tasks = listTasks(job.userId);
  const activities = listActivities(job.userId);
  const notifications = listNotifications(job.userId);
  const digest = buildDigestBody({
    title: job.title,
    audience: job.payload.audience,
    sessions,
    tasks,
    activities,
    notifications,
  });

  const deliveryChannels: WorkDeliveryRecord[] = [];
  const artifactRefs: WorkArtifactRecord[] = [
    { kind: 'digest', label: `${job.title} digest` },
    { kind: 'summary', label: `${job.title} summary` },
  ];

  let notionUrl: string | null = null;
  if (job.payload.deliverToNotion && isNotionConfigured(job.workspaceId)) {
    const notionResult = await createNotionPage(job.workspaceId, {
      title: job.title,
      content: digest.body,
    });
    notionUrl = notionResult.url;
    deliveryChannels.push({
      channel: 'notion',
      destinationLabel: 'Notion workspace',
      deliveredAt: new Date().toISOString(),
      status: 'delivered',
    });
    artifactRefs.push({ kind: 'notion_page', label: `${job.title} Notion page`, url: notionUrl });
  }

  if (job.payload.notifyInSlack && isSlackConfigured(job.workspaceId)) {
    await postSlackMessage(job.workspaceId, {
      text: `Crewmate generated the ${job.title}. ${digest.summary}.${notionUrl ? ` Notion: ${notionUrl}` : ''}`,
    });
    deliveryChannels.push({
      channel: 'slack',
      destinationLabel: 'Slack default channel',
      deliveredAt: new Date().toISOString(),
      status: 'delivered',
    });
  }

  markJobFinished(
    job.id,
    job.userId,
    'completed',
    {
      summary: digest.summary,
      digest: digest.body,
      notionUrl,
    },
    {
      deliveryChannels,
      artifactRefs,
      handoffLogEntry: {
        at: new Date().toISOString(),
        type: 'delivered',
        actor: 'system',
        summary: notionUrl ? 'Generated digest and delivered it to Notion with optional Slack update' : 'Generated digest snapshot',
      },
    },
  );

  insertTask(`Completed off-shift digest: ${job.title}`, 'Crewmate', 'completed', job.userId);
  insertActivity(
    'Delegated daily digest completed',
    `Crewmate compiled the ${job.title.toLowerCase()} for ${job.payload.audience}.`,
    'research',
    job.userId,
  );

  await maybeSendTelegramJobUpdate(job.workspaceId, {
    artifactUrl: notionUrl,
    jobId: job.id,
    status: 'completed',
    summary: digest.summary,
    title: job.title,
  });
}

async function runWorkflowRunJob(job: {
  id: string;
  workspaceId: string;
  userId: string;
  payload: WorkflowRunPayload;
  title: string;
  deliveryChannels: WorkDeliveryRecord[];
  artifactRefs: WorkArtifactRecord[];
  handoffLog: WorkHandoffRecord[];
}): Promise<void> {
  const orchestration = await orchestrate(job.payload.intent, {
    userId: job.userId,
    workspaceId: job.workspaceId,
  });
  const agentTask = await waitForAgentTask(orchestration.taskId, job.userId);

  if (!agentTask) {
    throw new Error('Agent task could not be loaded after orchestration.');
  }

  if (agentTask.status === 'failed') {
    throw new Error(agentTask.error ?? 'Agent workflow failed.');
  }

  const resultText = formatWorkflowResult(agentTask.result);
  const deliveryChannels: WorkDeliveryRecord[] = [];
  const artifactRefs: WorkArtifactRecord[] = [
    { kind: 'summary', label: `${job.title} result summary` },
    { kind: 'doc', label: 'Agent task record', url: `/agents?task=${orchestration.taskId}` },
  ];

  let notionUrl: string | null = null;
  if (job.payload.deliverToNotion && isNotionConfigured(job.workspaceId)) {
    const notionResult = await createNotionPage(job.workspaceId, {
      title: job.title,
      content: resultText,
    });
    notionUrl = notionResult.url;
    deliveryChannels.push({
      channel: 'notion',
      destinationLabel: 'Notion workspace',
      deliveredAt: new Date().toISOString(),
      status: 'delivered',
    });
    artifactRefs.push({ kind: 'notion_page', label: `${job.title} Notion page`, url: notionUrl });
  }

  if (job.payload.notifyInSlack && isSlackConfigured(job.workspaceId)) {
    await postSlackMessage(job.workspaceId, {
      text: `Crewmate completed "${job.title}".${notionUrl ? ` Notion: ${notionUrl}` : ''}`,
    });
    deliveryChannels.push({
      channel: 'slack',
      destinationLabel: 'Slack default channel',
      deliveredAt: new Date().toISOString(),
      status: 'delivered',
    });
  }

  markJobFinished(
    job.id,
    job.userId,
    'completed',
    {
      summary: resultText.slice(0, 280),
      result: agentTask.result,
      agentTaskId: orchestration.taskId,
      notionUrl,
    },
    {
      deliveryChannels,
      artifactRefs,
      handoffLogEntry: {
        at: new Date().toISOString(),
        type: 'delivered',
        actor: 'system',
        summary: notionUrl ? 'Workflow completed and delivered to Notion with optional Slack update' : 'Workflow completed through the orchestrator',
      },
    },
  );

  insertTask(`Completed off-shift workflow: ${job.title}`, 'Crewmate', 'completed', job.userId);
  insertActivity(
    'Delegated workflow completed',
    `Crewmate completed "${job.title}" through the orchestrator.`,
    'research',
    job.userId,
  );

  await maybeSendTelegramJobUpdate(job.workspaceId, {
    artifactUrl: notionUrl ?? `${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/agents?task=${encodeURIComponent(orchestration.taskId)}`,
    jobId: job.id,
    status: 'completed',
    summary: resultText.slice(0, 280),
    title: job.title,
  });
}

export async function processPendingJobs(): Promise<void> {
  const job = getNextQueuedJob();
  if (!job) {
    return;
  }

  markJobRunning(job.id, job.userId);

  try {
    if (job.type === 'daily_digest') {
      await runDailyDigestJob(job as typeof job & { payload: DailyDigestPayload });
    } else if (job.type === 'workflow_run') {
      await runWorkflowRunJob(job as typeof job & { payload: WorkflowRunPayload });
    } else {
      await runResearchBriefJob(job as typeof job & { payload: ResearchBriefPayload });
    }
  } catch (error) {
    const summary = 'goal' in job.payload
      ? job.payload.goal
      : 'audience' in job.payload
        ? `Summarize recent work for ${job.payload.audience}`
        : job.payload.intent;
    markJobFinished(
      job.id,
      job.userId,
      'failed',
      {
        summary,
      },
      { errorMessage: error instanceof Error ? error.message : 'Job failed' },
    );
    insertActivity(
      'Delegated async job failed',
      `Background job "${job.title}" failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      'note',
    );
    await maybeSendTelegramJobUpdate(job.workspaceId, {
      jobId: job.id,
      status: 'failed',
      summary: error instanceof Error ? error.message : 'Job failed',
      title: job.title,
    });
  }
}
