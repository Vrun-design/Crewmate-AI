import { db } from '../db';
import { listIntegrationCatalog } from '../services/integrationCatalog';
import type {
  ActivityRecord,
  DashboardPayload,
  MemoryNodeRecord,
  SessionRecord,
  TaskRecord,
  TranscriptMessage,
} from '../types';

function getTranscriptForSession(sessionId: string): TranscriptMessage[] {
  const rows = db.prepare(`
    SELECT id, role, text, status
    FROM session_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId) as TranscriptMessage[];

  return rows;
}

function getCurrentSession(): SessionRecord | null {
  const row = db.prepare(`
    SELECT id, status, started_at as startedAt, ended_at as endedAt
    FROM sessions
    WHERE status IN ('connecting', 'live')
    ORDER BY started_at DESC
    LIMIT 1
  `).get() as Omit<SessionRecord, 'transcript'> | undefined;

  if (!row) {
    return null;
  }

  return {
    ...row,
    transcript: getTranscriptForSession(row.id),
  };
}

export function getDashboardPayload(workspaceId: string, userId: string): DashboardPayload {
  const tasks = db.prepare(`
    SELECT id, title, status, time, tool_name as tool, priority
    FROM tasks
    ORDER BY id DESC
    LIMIT 6
  `).all() as TaskRecord[];

  const activities = db.prepare(`
    SELECT id, title, description, time, type
    FROM activities
    ORDER BY id DESC
    LIMIT 8
  `).all() as ActivityRecord[];

  const integrations = listIntegrationCatalog(workspaceId, userId);

  const memoryNodes = db.prepare(`
    SELECT id, title, type, tokens, last_synced as lastSynced, active
    FROM memory_nodes
    ORDER BY id ASC
  `).all().map((row) => ({
    ...row,
    active: Boolean((row as { active: number }).active),
  })) as MemoryNodeRecord[];

  return {
    tasks,
    activities,
    integrations,
    memoryNodes,
    currentSession: getCurrentSession(),
  };
}
