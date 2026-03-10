import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { serverConfig } from '../config';
import { insertActivity, insertTask } from './activityService';
import { createNotionPage, isNotionConfigured } from './notionService';
import { postSlackMessage, isSlackConfigured } from './slackService';
import { broadcastEvent } from './eventService';
import type { JobRecord } from '../types';

interface ResearchBriefPayload {
  topic: string;
  goal: string;
  audience: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
}

interface StoredJobRow {
  id: string;
  workspaceId: string;
  type: 'research_brief';
  status: JobRecord['status'];
  title: string;
  payloadJson: string;
  resultJson?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
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
  const payload = parseJson<ResearchBriefPayload>(row.payloadJson, {
    topic: row.title,
    goal: '',
    audience: 'team',
    deliverToNotion: false,
    notifyInSlack: false,
  });
  const result = parseJson<{ summary?: string }>(row.resultJson, {});

  return {
    id: row.id,
    type: row.type,
    status: row.status,
    title: row.title,
    summary: result.summary ?? payload.goal ?? 'Delegated async research job',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt ?? null,
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
      completed_at as completedAt
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
): JobRecord {
  const now = new Date().toISOString();
  const id = `JOB-${randomUUID()}`;
  const title = payload.topic.trim() || 'Async research brief';

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
      created_at,
      updated_at,
      started_at,
      completed_at
    ) VALUES (?, ?, ?, 'research_brief', 'queued', ?, ?, NULL, NULL, ?, ?, NULL, NULL)
  `).run(id, workspaceId, userId, title, JSON.stringify(payload), now, now);

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
  };
}

function getNextQueuedJob(): { id: string; workspaceId: string; userId: string; payload: ResearchBriefPayload; title: string } | null {
  const row = db.prepare(`
    SELECT id, workspace_id as workspaceId, user_id as userId, title, payload_json as payloadJson
    FROM jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
  `).get() as { id: string; workspaceId: string; userId: string; title: string; payloadJson: string } | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    title: row.title,
    payload: parseJson<ResearchBriefPayload>(row.payloadJson, {
      topic: row.title,
      goal: '',
      audience: 'team',
      deliverToNotion: false,
      notifyInSlack: false,
    }),
  };
}

function markJobRunning(jobId: string, userId: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs
    SET status = 'running', started_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, jobId);

  broadcastEvent(userId, 'job_update', { jobId, status: 'running' });
}

function markJobFinished(jobId: string, userId: string, status: 'completed' | 'failed', result: unknown, errorMessage?: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs
    SET status = ?, result_json = ?, error_message = ?, updated_at = ?, completed_at = ?
    WHERE id = ?
  `).run(status, JSON.stringify(result), errorMessage ?? null, now, now, jobId);

  broadcastEvent(userId, 'job_update', { jobId, status });
}

async function runResearchBriefJob(job: { id: string; workspaceId: string; userId: string; payload: ResearchBriefPayload; title: string }): Promise<void> {
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

  let notionUrl: string | null = null;
  if (job.payload.deliverToNotion && isNotionConfigured(job.workspaceId)) {
    const notionResult = await createNotionPage(job.workspaceId, {
      title: `${job.title} Brief`,
      content: brief,
    });
    notionUrl = notionResult.url;
  }

  if (job.payload.notifyInSlack && isSlackConfigured(job.workspaceId)) {
    await postSlackMessage(job.workspaceId, {
      text: `Crewmate completed the delegated brief for "${job.title}".${notionUrl ? ` Notion: ${notionUrl}` : ''}`,
    });
  }

  markJobFinished(job.id, job.userId, 'completed', {
    summary: job.payload.goal,
    plan,
    findings,
    brief,
    notionUrl,
  });

  insertTask(`Completed delegated research: ${job.title}`, 'Crewmate');
  insertActivity(
    'Delegated async job completed',
    notionUrl
      ? `Finished the background brief for "${job.title}" and published it to Notion.`
      : `Finished the background brief for "${job.title}".`,
    'research',
  );
}

export async function processPendingJobs(): Promise<void> {
  const job = getNextQueuedJob();
  if (!job) {
    return;
  }

  markJobRunning(job.id, job.userId);

  try {
    await runResearchBriefJob(job);
  } catch (error) {
    markJobFinished(job.id, job.userId, 'failed', { summary: job.payload.goal }, error instanceof Error ? error.message : 'Job failed');
    insertActivity(
      'Delegated async job failed',
      `Background brief "${job.title}" failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      'note',
    );
  }
}
