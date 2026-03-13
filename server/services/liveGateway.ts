import { updateSessionStatus } from '../repositories/sessionRepository';
import { insertActivity } from './activityService';
import { getSessionUserId } from '../repositories/sessionRepository';
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

  return sendInitialGreeting(runtime);
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
