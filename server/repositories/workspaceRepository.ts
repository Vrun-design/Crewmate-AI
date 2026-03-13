import { randomUUID } from 'node:crypto';
import { db } from '../db';
import type { ActivityRecord, TaskDetailRecord, TaskRecord, TaskRunRecord } from '../types';
import {
  buildTaskDetailRecord,
  formatDuration,
  formatSessionDate,
  mapTaskRow,
  mapTaskRunRow,
  type SessionHistoryRecord,
  type TaskRow,
  type TaskRunRow,
} from './workspaceRepositoryMappers';
import { TASK_RUN_SELECT_COLUMNS, TASK_SELECT_COLUMNS } from './workspaceRepositoryQueries';

function getSessionTitle(sessionId: string): string {
  const firstUserMessage = db.prepare(`
    SELECT text
    FROM session_messages
    WHERE session_id = ? AND role = 'user'
    ORDER BY created_at ASC
    LIMIT 1
  `).get(sessionId) as { text?: string } | undefined;

  const raw = firstUserMessage?.text?.trim();
  if (!raw) {
    return 'Live multimodal session';
  }

  return raw.length > 48 ? `${raw.slice(0, 47).trim()}...` : raw;
}

function getSessionTurnCount(sessionId: string): number {
  const row = db.prepare(`
    SELECT COUNT(*) as count
    FROM session_messages
    WHERE session_id = ? AND role = 'user'
  `).get(sessionId) as { count: number };

  return row.count;
}

export function listTasks(userId?: string): TaskRecord[] {
  const query = userId
    ? `
      SELECT ${TASK_SELECT_COLUMNS}
      FROM tasks
      WHERE user_id = ? OR user_id = '__system__'
      ORDER BY id DESC
    `
    : `
      SELECT ${TASK_SELECT_COLUMNS}
      FROM tasks
      ORDER BY id DESC
    `;
  const rows = userId
    ? db.prepare(query).all(userId) as TaskRow[]
    : db.prepare(query).all() as TaskRow[];
  return rows.map(mapTaskRow);
}

interface CreateTaskInput {
  title: string;
  description?: string;
  tool: string;
  priority: TaskRecord['priority'];
  status?: TaskRecord['status'];
  url?: string;
  linkedAgentTaskId?: string;
  sourceKind?: TaskRecord['sourceKind'];
  currentRunId?: string | null;
  linkedSessionId?: string | null;
  artifactCount?: number;
}

function getTimestampLabel(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function createWorkspaceTask(userId: string, input: CreateTaskInput): TaskRecord {
  const id = `TSK-${randomUUID()}`;
  const task: TaskRecord = {
    id,
    title: input.title,
    description: input.description?.trim() || null,
    status: input.status ?? 'pending',
    time: getTimestampLabel(),
    tool: input.tool,
    priority: input.priority,
    url: input.url ?? null,
    linkedAgentTaskId: input.linkedAgentTaskId ?? null,
    sourceKind: input.sourceKind ?? 'manual',
    currentRunId: input.currentRunId ?? null,
    linkedSessionId: input.linkedSessionId ?? null,
    artifactCount: input.artifactCount ?? 0,
  };

  db.prepare(`
    INSERT INTO tasks (
      id, user_id, title, description, status, time, tool_name, priority, url,
      linked_agent_task_id, source_kind, current_run_id, linked_session_id, artifact_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id,
    userId,
    task.title,
    task.description,
    task.status,
    task.time,
    task.tool,
    task.priority,
    task.url,
    task.linkedAgentTaskId,
    task.sourceKind,
    task.currentRunId,
    task.linkedSessionId,
    task.artifactCount,
  );

  return task;
}

export function updateWorkspaceTask(taskId: string, userId: string, patch: Partial<TaskRecord>): void {
  db.prepare(`
    UPDATE tasks
    SET status = COALESCE(?, status),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        tool_name = COALESCE(?, tool_name),
        url = COALESCE(?, url),
        current_run_id = COALESCE(?, current_run_id),
        linked_session_id = COALESCE(?, linked_session_id),
        artifact_count = COALESCE(?, artifact_count)
    WHERE id = ? AND user_id = ?
  `).run(
    patch.status ?? null,
    patch.title ?? null,
    patch.description ?? null,
    patch.tool ?? null,
    patch.url ?? null,
    patch.currentRunId ?? null,
    patch.linkedSessionId ?? null,
    patch.artifactCount ?? null,
    taskId,
    userId,
  );
}

export function updateWorkspaceTaskByLinkedAgentTaskId(userId: string, linkedAgentTaskId: string, patch: Partial<TaskRecord>): void {
  const row = db.prepare('SELECT id FROM tasks WHERE user_id = ? AND linked_agent_task_id = ? LIMIT 1').get(userId, linkedAgentTaskId) as { id?: string } | undefined;
  if (!row?.id) {
    return;
  }
  updateWorkspaceTask(row.id, userId, patch);
}

export function getTaskRecord(taskId: string, userId: string): TaskRecord | null {
  const row = db.prepare(`
    SELECT ${TASK_SELECT_COLUMNS}
    FROM tasks
    WHERE id = ? AND user_id = ?
    LIMIT 1
  `).get(taskId, userId) as TaskRow | undefined;
  return row ? mapTaskRow(row) : null;
}

export function createTaskRun(input: {
  taskId: string;
  userId: string;
  workspaceId?: string;
  runType: TaskRunRecord['runType'];
  agentId?: string;
  skillId?: string;
  status: TaskRunRecord['status'];
  steps?: unknown[];
  result?: unknown;
  error?: string | null;
  originType?: TaskRunRecord['originType'];
  originRef?: string | null;
  linkedAgentTaskId?: string | null;
  startedAt?: string;
  completedAt?: string | null;
}): TaskRunRecord {
  const id = `RUN-${randomUUID()}`;
  const now = new Date().toISOString();
  const startedAt = input.startedAt ?? now;
  db.prepare(`
    INSERT INTO task_runs (
      id, task_id, user_id, workspace_id, run_type, agent_id, skill_id, status, steps_json, result_json, error,
      origin_type, origin_ref, linked_agent_task_id, started_at, completed_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.taskId,
    input.userId,
    input.workspaceId ?? null,
    input.runType,
    input.agentId ?? null,
    input.skillId ?? null,
    input.status,
    JSON.stringify(input.steps ?? []),
    input.result !== undefined ? JSON.stringify(input.result) : null,
    input.error ?? null,
    input.originType ?? null,
    input.originRef ?? null,
    input.linkedAgentTaskId ?? null,
    startedAt,
    input.completedAt ?? null,
    now,
    now,
  );

  updateWorkspaceTask(input.taskId, input.userId, { currentRunId: id });
  return getTaskRuns(input.taskId, input.userId).find((run) => run.id === id)!;
}

export function updateTaskRun(runId: string, userId: string, patch: Partial<TaskRunRecord>): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE task_runs
    SET status = COALESCE(?, status),
        steps_json = COALESCE(?, steps_json),
        result_json = COALESCE(?, result_json),
        error = COALESCE(?, error),
        completed_at = COALESCE(?, completed_at),
        updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(
    patch.status ?? null,
    patch.steps ? JSON.stringify(patch.steps) : null,
    patch.result !== undefined ? JSON.stringify(patch.result) : null,
    patch.error ?? null,
    patch.completedAt ?? null,
    now,
    runId,
    userId,
  );
}

export function getTaskRuns(taskId: string, userId: string): TaskRunRecord[] {
  const rows = db.prepare(`
    SELECT ${TASK_RUN_SELECT_COLUMNS}
    FROM task_runs
    WHERE task_id = ? AND user_id = ?
    ORDER BY started_at DESC
  `).all(taskId, userId) as TaskRunRow[];
  return rows.map(mapTaskRunRow);
}

export function getTaskByRunId(runId: string, userId: string): TaskDetailRecord | null {
  const row = db.prepare(`
    SELECT task_id as taskId
    FROM task_runs
    WHERE id = ? AND user_id = ?
    LIMIT 1
  `).get(runId, userId) as { taskId?: string } | undefined;

  if (!row?.taskId) {
    return null;
  }

  return getTaskDetail(row.taskId, userId);
}

export function getLatestTaskRun(taskId: string, userId: string): TaskRunRecord | null {
  return getTaskRuns(taskId, userId)[0] ?? null;
}

export function listTaskRunsForUser(userId: string, options?: {
  limit?: number;
  statuses?: TaskRunRecord['status'][];
  includeRunTypes?: TaskRunRecord['runType'][];
}): TaskRunRecord[] {
  const clauses = ['user_id = ?'];
  const params: Array<string | number> = [userId];

  if (options?.statuses?.length) {
    clauses.push(`status IN (${options.statuses.map(() => '?').join(', ')})`);
    params.push(...options.statuses);
  }

  if (options?.includeRunTypes?.length) {
    clauses.push(`run_type IN (${options.includeRunTypes.map(() => '?').join(', ')})`);
    params.push(...options.includeRunTypes);
  }

  const limit = options?.limit ?? 20;
  params.push(limit);

  const rows = db.prepare(`
    SELECT ${TASK_RUN_SELECT_COLUMNS}
    FROM task_runs
    WHERE ${clauses.join(' AND ')}
    ORDER BY started_at DESC
    LIMIT ?
  `).all(...params) as TaskRunRow[];

  return rows.map(mapTaskRunRow);
}

export function listActiveTaskRuns(userId: string, limit = 6): TaskRunRecord[] {
  return listTaskRunsForUser(userId, {
    limit,
    statuses: ['queued', 'running'],
    includeRunTypes: ['delegated_skill', 'delegated_agent'],
  });
}

export function cancelTaskRun(runId: string, userId: string, errorMessage = 'Cancelled by user'): TaskRunRecord | null {
  const detail = getTaskByRunId(runId, userId);
  const run = detail?.runs.find((candidate) => candidate.id === runId) ?? null;
  if (!detail || !run) {
    return null;
  }

  if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') {
    return run;
  }

  const completedAt = new Date().toISOString();
  updateTaskRun(runId, userId, {
    status: 'cancelled',
    error: errorMessage,
    completedAt,
  });
  updateWorkspaceTask(detail.id, userId, {
    status: 'cancelled',
    currentRunId: runId,
  });

  return getTaskRuns(detail.id, userId).find((candidate) => candidate.id === runId) ?? null;
}

export function getTaskDetail(taskId: string, userId: string): TaskDetailRecord | null {
  const task = getTaskRecord(taskId, userId);
  if (!task) {
    return null;
  }
  const runs = getTaskRuns(taskId, userId);
  return buildTaskDetailRecord(task, runs);
}

export function findTaskByLinkedAgentTaskId(userId: string, linkedAgentTaskId: string): TaskRecord | null {
  const row = db.prepare(`
    SELECT ${TASK_SELECT_COLUMNS}
    FROM tasks
    WHERE user_id = ? AND linked_agent_task_id = ?
    LIMIT 1
  `).get(userId, linkedAgentTaskId) as TaskRow | undefined;
  return row ? mapTaskRow(row) : null;
}

export function findLatestArtifactTask(userId: string, options?: { provider?: string; sessionId?: string | null }): TaskRecord | null {
  const clauses = ['user_id = ?', 'url IS NOT NULL'];
  const params: Array<string> = [userId];

  if (options?.provider === 'notion') {
    clauses.push(`url LIKE '%notion.so%'`);
  } else if (options?.provider === 'clickup') {
    clauses.push(`url LIKE '%clickup.com%'`);
  }

  if (options?.sessionId) {
    clauses.push('linked_session_id = ?');
    params.push(options.sessionId);
  }

  const row = db.prepare(`
    SELECT ${TASK_SELECT_COLUMNS}
    FROM tasks
    WHERE ${clauses.join(' AND ')}
    ORDER BY rowid DESC
    LIMIT 1
  `).get(...params) as TaskRow | undefined;

  return row ? mapTaskRow(row) : null;
}

export function listActivities(userId?: string): ActivityRecord[] {
  if (userId) {
    return db.prepare(`
      SELECT id, title, description, time, type
      FROM activities
      WHERE user_id = ? OR user_id = '__system__'
      ORDER BY id DESC
    `).all(userId) as ActivityRecord[];
  }
  return db.prepare(`
    SELECT id, title, description, time, type
    FROM activities
    ORDER BY id DESC
  `).all() as ActivityRecord[];
}

export function listSessionHistory(userId?: string): SessionHistoryRecord[] {
  const rows = userId
    ? db.prepare(`
      SELECT id, started_at as startedAt, ended_at as endedAt
      FROM sessions
      WHERE user_id = ?
      ORDER BY started_at DESC
    `).all(userId) as Array<{ id: string; startedAt: string; endedAt?: string | null }>
    : db.prepare(`
      SELECT id, started_at as startedAt, ended_at as endedAt
      FROM sessions
      ORDER BY started_at DESC
    `).all() as Array<{ id: string; startedAt: string; endedAt?: string | null }>;

  return rows.map((row) => ({
    id: row.id,
    title: getSessionTitle(row.id),
    date: formatSessionDate(row.startedAt),
    duration: formatDuration(row.startedAt, row.endedAt),
    tasks: getSessionTurnCount(row.id),
  }));
}
