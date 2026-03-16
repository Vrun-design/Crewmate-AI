import { updateSessionStatus, getSessionUserId, getSession } from '../repositories/sessionRepository';
import { insertActivity } from './activityService';
import type { SessionRecord } from '../types';
import { sendInitialGreeting } from './liveGatewayLifecycle';
import {
  createRuntimeSession,
  endGeminiLiveSession,
  endLiveAudioInput,
  getLiveAudioChunks,
  getLiveSessionState,
  sendLiveAudioChunk,
  sendLiveMessage,
  sendLiveVideoFrame,
} from './liveGatewayTransport';

export async function startGeminiLiveSession(sessionId: string): Promise<SessionRecord> {
  const userId = getSessionUserId(sessionId);
  if (!userId) {
    throw new Error('Cannot start a live session without an authenticated user.');
  }

  updateSessionStatus(sessionId, 'connecting', null);
  const runtime = await createRuntimeSession(sessionId, userId);

  updateSessionStatus(sessionId, 'live', null);
  insertActivity('Gemini Live connected', 'The dashboard is now backed by a real Gemini Live session.', 'observation');

  // Fire greeting without blocking session startup — if greeting fails the session is still live
  void sendInitialGreeting(runtime).catch((err) => {
    console.warn('[live-session] Initial greeting failed (non-fatal):', err instanceof Error ? err.message : err);
  });

  const session = getSession(sessionId);
  if (!session) throw new Error('Session record missing after connect.');
  return session;
}
export {
  sendLiveMessage,
  sendLiveVideoFrame,
  sendLiveAudioChunk,
  endLiveAudioInput,
  getLiveAudioChunks,
  getLiveSessionState,
  endGeminiLiveSession,
};
