import { randomUUID } from 'node:crypto';
import { createUserContent } from '@google/genai';
import { getSession, getSessionUserId, insertTranscriptMessage, updateSessionStatus } from '../repositories/sessionRepository';
import { getRuntimeSession, deleteRuntimeSession, setRuntimeSession } from './liveGatewayRuntimeStore';
import { clearPendingTurn, createPendingTurn } from './liveGatewayPendingTurn';
import { getUserPreferences } from './preferencesService';
import { buildUserSystemInstruction } from './liveGatewayPromptBuilder';
import { insertActivity } from './activityService';
import { broadcastEvent } from './eventService';
import { connectGeminiSession } from './liveGatewayLifecycle';
import type { AudioChunkRecord, SessionRecord } from '../types';
import type { RuntimeSession } from './liveGatewayTypes';

export async function createRuntimeSession(sessionId: string, userId: string): Promise<RuntimeSession> {
  const preferences = getUserPreferences(userId);
  const systemInstruction = await buildUserSystemInstruction(userId, { liveFast: true });
  const { session, connectionId } = await connectGeminiSession(sessionId, preferences, systemInstruction);

  const runtime: RuntimeSession = {
    id: sessionId,
    provider: 'gemini-live',
    session,
    connectionId,
    pendingTurn: null,
    currentAssistantMessageId: null,
    currentAssistantModelText: '',
    currentAssistantOutputTranscriptionText: '',
    currentUserTranscriptionMessageId: null,
    currentUserTranscriptionText: '',
    lastUserTurnText: null,
    hasVideoContext: false,
    hasAudioContext: false,
    audioChunks: [],
    nextAudioChunkId: 1,
    lastAudioChunkSignature: null,
    playbackRevision: 0,
    sessionResumptionHandle: null,
    canResume: false,
    isReconnecting: false,
    lastConsumedClientMessageIndex: null,
    lastFrameData: null,
    lastUserActivityTime: Date.now(),
    lastProactiveTime: null,
    proactiveInterval: null,
  };

  runtime.proactiveInterval = setInterval(() => {
    if (!runtime.hasVideoContext) {
      return;
    }

    const now = Date.now();
    if (now - runtime.lastUserActivityTime <= 5 * 60 * 1000) {
      return;
    }

    if (runtime.lastProactiveTime && (now - runtime.lastProactiveTime) < 5 * 60 * 1000) {
      return;
    }

    const preferencesSnapshot = getUserPreferences(userId);
    if (!preferencesSnapshot.proactiveSuggestions) {
      return;
    }

    runtime.lastProactiveTime = now;
    runtime.session.sendClientContent({
      turns: createUserContent('Silently analyze the current screen and proactively flag any issues, blockers, or things I should know about.'),
      turnComplete: true,
    });
    insertActivity('Proactive analysis', 'Triggered a background screen analysis due to user inactivity.', 'observation', userId);
  }, 30000);

  setRuntimeSession(sessionId, runtime);
  return runtime;
}

export function sendLiveMessage(sessionId: string, text: string): Promise<SessionRecord> {
  const runtime = getRuntimeSession(sessionId);
  if (!runtime) {
    throw new Error('Live runtime not found. Start a Gemini session first.');
  }

  if (runtime.pendingTurn) {
    runtime.pendingTurn.reject(new Error('Interrupted by a newer user request.'));
    clearPendingTurn(runtime);
    runtime.playbackRevision += 1;
    runtime.audioChunks = [];
    runtime.nextAudioChunkId = 1;
    runtime.lastAudioChunkSignature = null;
  }

  runtime.lastUserTurnText = text;
  runtime.lastUserActivityTime = Date.now();
  insertTranscriptMessage({
    id: randomUUID(),
    sessionId,
    role: 'user',
    text,
    status: 'complete',
  });

  const userId = getSessionUserId(runtime.id);
  if (userId) {
    broadcastEvent(userId, 'session_update', { sessionId: runtime.id });
  }

  const responsePromise = createPendingTurn(runtime, 45000, 'Gemini Live response timed out.');
  runtime.session.sendClientContent({
    turns: createUserContent(text),
    turnComplete: true,
  });

  return responsePromise;
}

export function sendLiveVideoFrame(sessionId: string, input: { mimeType: string; data: string }): void {
  const runtime = getRuntimeSession(sessionId);
  if (!runtime) {
    throw new Error('Live runtime not found. Start a Gemini session first.');
  }

  runtime.lastFrameData = { mimeType: input.mimeType, data: input.data };
  runtime.session.sendRealtimeInput({ video: input });

  if (!runtime.hasVideoContext) {
    runtime.hasVideoContext = true;
    insertActivity('Screen share connected', 'Crewmate is now receiving live screen frames for visual analysis.', 'observation');
  }
}

export function sendLiveAudioChunk(sessionId: string, input: { mimeType: string; data: string }): void {
  const runtime = getRuntimeSession(sessionId);
  if (!runtime) {
    throw new Error('Live runtime not found. Start a Gemini session first.');
  }

  runtime.session.sendRealtimeInput({ audio: input });

  if (!runtime.hasAudioContext) {
    runtime.hasAudioContext = true;
    insertActivity('Microphone connected', 'Crewmate is now receiving live microphone audio for realtime reasoning.', 'observation');
  }
}

export function endLiveAudioInput(sessionId: string): void {
  const runtime = getRuntimeSession(sessionId);
  if (!runtime) {
    throw new Error('Live runtime not found. Start a Gemini session first.');
  }

  runtime.session.sendRealtimeInput({ audioStreamEnd: true });
}

export function getLiveAudioChunks(sessionId: string, afterChunkId = 0): AudioChunkRecord[] {
  const runtime = getRuntimeSession(sessionId);
  if (!runtime) {
    return [];
  }

  return runtime.audioChunks.filter((chunk) => chunk.id > afterChunkId);
}

export function getLiveSessionState(sessionId: string): SessionRecord | null {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const runtime = getRuntimeSession(sessionId);
  if (!runtime) {
    return {
      ...session,
      provider: session.provider ?? 'local',
      audioChunks: [],
      playbackRevision: 0,
    };
  }

  return {
    ...session,
    provider: 'gemini-live',
    audioChunks: [...runtime.audioChunks],
    playbackRevision: runtime.playbackRevision,
  };
}

export function endGeminiLiveSession(sessionId: string): SessionRecord | null {
  const runtime = getRuntimeSession(sessionId);
  if (runtime?.proactiveInterval) {
    clearInterval(runtime.proactiveInterval);
  }

  runtime?.session.close();
  deleteRuntimeSession(sessionId);
  updateSessionStatus(sessionId, 'ended', new Date().toISOString());

  const userId = getSessionUserId(sessionId);
  if (userId) {
    broadcastEvent(userId, 'session_update', { sessionId });
  }

  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  insertActivity('Gemini Live disconnected', 'The live backend session was closed and persisted locally.', 'note');

  return {
    ...session,
    provider: 'gemini-live',
    playbackRevision: runtime?.playbackRevision ?? 0,
  };
}
