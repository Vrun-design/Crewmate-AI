import {randomUUID} from 'node:crypto';
import {db} from '../db';
import {serverConfig} from '../config';
import {insertActivity, insertTask} from './activityService';
import {createGeminiClient} from './geminiClient';
import {createNotionPage, isNotionConfigured} from './notionService';
import {postSlackMessage, isSlackConfigured} from './slackService';
import type {JobRecord} from '../types';

interface ResearchBriefPayload {
  topic: string;
  goal: string;
  audience: string;
  deliverToNotion: boolean;
  notifyInSlack: boolean;
}

interface StoredJobRow {
  id: string;
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
  const result = parseJson<{summary?: string}>(row.resultJson, {});

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
  userId: string,
  payload: ResearchBriefPayload,
): JobRecord {
  const now = new Date().toISOString();
  const id = `JOB-${randomUUID()}`;
  const title = payload.topic.trim() || 'Async research brief';

  db.prepare(`
    INSERT INTO jobs (
      id,
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
    ) VALUES (?, ?, 'research_brief', 'queued', ?, ?, NULL, NULL, ?, ?, NULL, NULL)
  `).run(id, userId, title, JSON.stringify(payload), now, now);

  insertTask(`Queued delegated research: ${title}`, 'Crewmate');
  insertActivity(
    'Delegated async job queued',
    `Crewmate queued a background research brief for "${title}".`,
    'research',
  );

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

function getNextQueuedJob(): {id: string; userId: string; payload: ResearchBriefPayload; title: string} | null {
  const row = db.prepare(`
    SELECT id, user_id as userId, title, payload_json as payloadJson
    FROM jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
  `).get() as {id: string; userId: string; title: string; payloadJson: string} | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
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

function markJobRunning(jobId: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs
    SET status = 'running', started_at = ?, updated_at = ?
    WHERE id = ?
  `).run(now, now, jobId);
}

function markJobFinished(jobId: string, status: 'completed' | 'failed', result: unknown, errorMessage?: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE jobs
    SET status = ?, result_json = ?, error_message = ?, updated_at = ?, completed_at = ?
    WHERE id = ?
  `).run(status, JSON.stringify(result), errorMessage ?? null, now, now, jobId);
}

function getText(response: unknown): string {
  if (response && typeof response === 'object' && 'text' in response) {
    return typeof (response as {text?: unknown}).text === 'string' ? (response as {text: string}).text : '';
  }
  return '';
}

async function generateResearchPlan(ai: ReturnType<typeof createGeminiClient>, payload: ResearchBriefPayload): Promise<string> {
  const response = await ai.models.generateContent({
    model: serverConfig.geminiResearchModel,
    contents: `You are an orchestrator agent. Create a concise 3-step execution plan for a background research brief.\nTopic: ${payload.topic}\nGoal: ${payload.goal}\nAudience: ${payload.audience}`,
  });

  return getText(response);
}

async function generateResearchFindings(ai: ReturnType<typeof createGeminiClient>, payload: ResearchBriefPayload, plan: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: serverConfig.geminiResearchModel,
    contents: `You are a research specialist agent. Produce a structured findings memo with key options, tradeoffs, and recommendations.\nTopic: ${payload.topic}\nGoal: ${payload.goal}\nAudience: ${payload.audience}\nPlan:\n${plan}`,
  });

  return getText(response);
}

async function generateExecutiveBrief(
  ai: ReturnType<typeof createGeminiClient>,
  payload: ResearchBriefPayload,
  plan: string,
  findings: string,
): Promise<string> {
  const response = await ai.models.generateContent({
    model: serverConfig.geminiTextModel,
    contents: `You are an editor agent. Turn the plan and findings below into a concise markdown brief with sections: Summary, Comparison, Recommendation, Next Actions.\nAudience: ${payload.audience}\nGoal: ${payload.goal}\nPlan:\n${plan}\nFindings:\n${findings}`,
  });

  return getText(response);
}

async function runResearchBriefJob(job: {id: string; userId: string; payload: ResearchBriefPayload; title: string}): Promise<void> {
  const ai = createGeminiClient();
  const plan = await generateResearchPlan(ai, job.payload);
  const findings = await generateResearchFindings(ai, job.payload, plan);
  const brief = await generateExecutiveBrief(ai, job.payload, plan, findings);

  let notionUrl: string | null = null;
  if (job.payload.deliverToNotion && isNotionConfigured(job.userId)) {
    const notionResult = await createNotionPage(job.userId, {
      title: `${job.title} Brief`,
      content: brief,
    });
    notionUrl = notionResult.url;
  }

  if (job.payload.notifyInSlack && isSlackConfigured(job.userId)) {
    await postSlackMessage(job.userId, {
      text: `Crewmate completed the delegated brief for "${job.title}".${notionUrl ? ` Notion: ${notionUrl}` : ''}`,
    });
  }

  markJobFinished(job.id, 'completed', {
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

  markJobRunning(job.id);

  try {
    await runResearchBriefJob(job);
  } catch (error) {
    markJobFinished(job.id, 'failed', {summary: job.payload.goal}, error instanceof Error ? error.message : 'Job failed');
    insertActivity(
      'Delegated async job failed',
      `Background brief "${job.title}" failed: ${error instanceof Error ? error.message : 'unknown error'}.`,
      'note',
    );
  }
}
