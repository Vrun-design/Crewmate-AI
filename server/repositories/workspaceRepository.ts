import { db } from '../db';
import type { ActivityRecord, TaskRecord } from '../types';

interface SessionHistoryRecord {
  id: string;
  title: string;
  date: string;
  duration: string;
  tasks: number;
}

function formatSessionDate(startedAt: string): string {
  const date = new Date(startedAt);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(startedAt: string, endedAt?: string | null): string {
  const startTime = new Date(startedAt).getTime();
  const endTime = endedAt ? new Date(endedAt).getTime() : Date.now();
  const durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

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
  if (userId) {
    return db.prepare(`
      SELECT id, title, description, status, time, tool_name as tool, priority, url
      FROM tasks
      WHERE user_id = ? OR user_id = '__system__'
      ORDER BY id DESC
    `).all(userId) as TaskRecord[];
  }
  return db.prepare(`
    SELECT id, title, description, status, time, tool_name as tool, priority, url
    FROM tasks
    ORDER BY id DESC
  `).all() as TaskRecord[];
}

interface CreateTaskInput {
  title: string;
  description?: string;
  tool: string;
  priority: TaskRecord['priority'];
  status?: TaskRecord['status'];
  url?: string;
}

function getTimestampLabel(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function createWorkspaceTask(userId: string, input: CreateTaskInput): TaskRecord {
  const id = `TSK-${crypto.randomUUID()}`;
  const task: TaskRecord = {
    id,
    title: input.title,
    description: input.description?.trim() || null,
    status: input.status ?? 'pending',
    time: getTimestampLabel(),
    tool: input.tool,
    priority: input.priority,
    url: input.url ?? null,
  };

  db.prepare(`
    INSERT INTO tasks (id, user_id, title, description, status, time, tool_name, priority, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(task.id, userId, task.title, task.description, task.status, task.time, task.tool, task.priority, task.url);

  return task;
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
