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
      text: 'Crewmate local preview is live. You can open the overlay, test screen-share permissions, and toggle the microphone controls.',
      status: 'complete',
    },
    {
      id: randomUUID(),
      role: 'agent',
      text: 'Configure a Gemini API key to enable real-time multimodal reasoning over live screen and voice input.',
      status: 'complete',
    },
  ];

  return createTranscript(sessionId, transcript);
}

export function startSession(userId?: string, options: StartSessionOptions = {}): SessionRecord {
  closeOpenSessions(userId);

  const sessionId = `SES-${randomUUID()}`;
  const startedAt = new Date().toISOString();
  const provider = options.provider ?? 'local';
  const shouldSeedTranscript = options.seedTranscript ?? provider === 'local';

  if (userId) {
    createUserSessionRecord(sessionId, userId, 'live', provider);
  } else {
    createSessionRecord(sessionId, 'live', provider);
  }

  const transcript = shouldSeedTranscript ? createLocalTranscript(sessionId) : [];

  insertActivity(
    'Live session started',
    'Crewmate is now listening locally and routing session state through the local backend.',
    'observation',
    userId,
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

export function sendLocalSessionMessage(sessionId: string, text: string): SessionRecord {
  const session = getSession(sessionId);
  if (!session) {
    throw new Error('Session not found.');
  }

  insertTranscriptMessage({
    id: randomUUID(),
    sessionId,
    role: 'user',
    text,
    status: 'complete',
  });

  insertTranscriptMessage({
    id: randomUUID(),
    sessionId,
    role: 'agent',
    text: 'Local preview received your message. Add a Gemini API key to enable live reasoning, audio responses, and multimodal analysis.',
    status: 'complete',
  });

  return {
    ...session,
    transcript: listTranscript(sessionId),
    provider: session.provider ?? 'local',
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
