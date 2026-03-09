import {randomUUID} from 'node:crypto';
import type {SessionRecord, TranscriptMessage} from '../types';
import {
  closeOpenSessions,
  createSessionRecord,
  createUserSessionRecord,
  getSession,
  insertTranscriptMessage,
  listTranscript,
  updateSessionStatus,
} from '../repositories/sessionRepository';
import {insertActivity} from './activityService';

interface StartSessionOptions {
  seedTranscript?: boolean;
  provider?: SessionRecord['provider'];
}

export function createTranscript(sessionId: string, messages: TranscriptMessage[]): TranscriptMessage[] {
  for (const message of messages) {
    insertTranscriptMessage({
      id: message.id,
      sessionId,
      role: message.role,
      text: message.text,
      status: message.status ?? 'complete',
    });
  }

  return messages;
}

function createLocalTranscript(sessionId: string): TranscriptMessage[] {
  const transcript: TranscriptMessage[] = [
    {
      id: randomUUID(),
      role: 'agent',
      text: 'Crewmate is live. Screen and voice channels are ready. I loaded your local product context and the latest memory summary.',
      status: 'complete',
    },
    {
      id: randomUUID(),
      role: 'agent',
      text: 'Show me a screen, ask for an action, or delegate a background task. I can route work to Slack, Notion, GitHub, ClickUp, and the local memory brain.',
      status: 'complete',
    },
  ];

  return createTranscript(sessionId, transcript);
}

export function startSession(userId?: string, options: StartSessionOptions = {}): SessionRecord {
  closeOpenSessions();

  const sessionId = `SES-${Math.floor(Math.random() * 900 + 100)}`;
  const startedAt = new Date().toISOString();
  const provider = options.provider ?? 'local';
  const shouldSeedTranscript = options.seedTranscript ?? provider === 'local';

  if (userId) {
    createUserSessionRecord(sessionId, userId, 'live');
  } else {
    createSessionRecord(sessionId, 'live');
  }

  const transcript = shouldSeedTranscript ? createLocalTranscript(sessionId) : [];

  insertActivity(
    'Live session started',
    'Crewmate is now listening locally and routing session state through the local backend.',
    'observation',
  );

  return {
    id: sessionId,
    status: 'live',
    startedAt,
    endedAt: null,
    transcript,
    provider,
  };
}

export function endSession(sessionId: string): SessionRecord | null {
  const row = getSession(sessionId);

  if (!row) {
    return null;
  }

  updateSessionStatus(sessionId, 'ended', new Date().toISOString());

  insertActivity(
    'Live session ended',
    'The local live session closed cleanly and preserved the transcript in memory.',
    'note',
  );

  const transcript = listTranscript(sessionId);

  return {
    ...row,
    status: 'ended',
    endedAt: new Date().toISOString(),
    transcript,
    provider: 'local',
  };
}
