import {db} from '../db';
import type {SessionRecord, TranscriptMessage} from '../types';

export function listTranscript(sessionId: string): TranscriptMessage[] {
  return db.prepare(`
    SELECT id, role, text, status
    FROM session_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId) as TranscriptMessage[];
}

export function getSession(sessionId: string): SessionRecord | null {
  const row = db.prepare(`
    SELECT id, status, started_at as startedAt, ended_at as endedAt, user_id as userId, provider
    FROM sessions
    WHERE id = ?
    LIMIT 1
  `).get(sessionId) as (Omit<SessionRecord, 'transcript'> & {userId?: string | null}) | undefined;

  if (!row) {
    return null;
  }

  return {
    ...row,
    transcript: listTranscript(sessionId),
  };
}

export function getCurrentSessionForUser(userId?: string): SessionRecord | null {
  const row = userId
    ? db.prepare(`
      SELECT id, status, started_at as startedAt, ended_at as endedAt, user_id as userId, provider
      FROM sessions
      WHERE user_id = ? AND status IN ('connecting', 'live')
      ORDER BY started_at DESC
      LIMIT 1
    `).get(userId) as (Omit<SessionRecord, 'transcript'> & {userId?: string | null}) | undefined
    : db.prepare(`
      SELECT id, status, started_at as startedAt, ended_at as endedAt, user_id as userId, provider
      FROM sessions
      WHERE status IN ('connecting', 'live')
      ORDER BY started_at DESC
      LIMIT 1
    `).get() as (Omit<SessionRecord, 'transcript'> & {userId?: string | null}) | undefined;

  if (!row) {
    return null;
  }

  return {
    ...row,
    transcript: listTranscript(row.id),
  };
}

export function createSessionRecord(
  sessionId: string,
  status: SessionRecord['status'],
  provider: SessionRecord['provider'] = 'local',
) {
  db.prepare(`
    INSERT INTO sessions (id, status, started_at, ended_at, user_id, provider)
    VALUES (?, ?, ?, NULL, ?, ?)
  `).run(sessionId, status, new Date().toISOString(), null, provider);
}

export function createUserSessionRecord(
  sessionId: string,
  userId: string,
  status: SessionRecord['status'],
  provider: SessionRecord['provider'] = 'local',
) {
  db.prepare(`
    INSERT INTO sessions (id, status, started_at, ended_at, user_id, provider)
    VALUES (?, ?, ?, NULL, ?, ?)
  `).run(sessionId, status, new Date().toISOString(), userId, provider);
}

export function updateSessionStatus(sessionId: string, status: SessionRecord['status'], endedAt?: string | null) {
  db.prepare(`
    UPDATE sessions
    SET status = ?, ended_at = ?
    WHERE id = ?
  `).run(status, endedAt ?? null, sessionId);
}

export function closeOpenSessions(userId?: string): void {
  if (userId) {
    db.prepare(`
      UPDATE sessions
      SET status = 'ended', ended_at = ?
      WHERE user_id = ? AND status IN ('connecting', 'live')
    `).run(new Date().toISOString(), userId);
    return;
  }

  db.prepare(`
    UPDATE sessions
    SET status = 'ended', ended_at = ?
    WHERE status IN ('connecting', 'live')
  `).run(new Date().toISOString());
}

export function getSessionUserId(sessionId: string): string | null {
  const row = db.prepare(`
    SELECT user_id as userId
    FROM sessions
    WHERE id = ?
    LIMIT 1
  `).get(sessionId) as {userId?: string | null} | undefined;

  return row?.userId ?? null;
}

export function insertTranscriptMessage(message: {
  id: string;
  sessionId: string;
  role: TranscriptMessage['role'];
  text: string;
  status?: TranscriptMessage['status'];
}) {
  db.prepare(`
    INSERT INTO session_messages (id, session_id, role, text, status, created_at)
    VALUES (@id, @sessionId, @role, @text, @status, @createdAt)
  `).run({
    ...message,
    status: message.status ?? 'complete',
    createdAt: new Date().toISOString(),
  });
}

export function updateTranscriptMessage(messageId: string, text: string, status: TranscriptMessage['status'] = 'complete') {
  db.prepare(`
    UPDATE session_messages
    SET text = ?, status = ?
    WHERE id = ?
  `).run(text, status, messageId);
}
