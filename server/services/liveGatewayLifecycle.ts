import {
  GoogleGenAI,
  createUserContent,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import { randomUUID } from 'node:crypto';
import { serverConfig } from '../config';
import { selectModel } from './modelRouter';
import { getUserPreferences } from './preferencesService';
import { getSkillDeclarations } from '../skills/registry';
import { buildLiveConnectConfig } from './liveGatewayConfig';
import { buildUserSystemInstruction } from './liveGatewayPromptBuilder';
import { getRuntimeSession } from './liveGatewayRuntimeStore';
import { clearPendingTurn, createPendingTurn } from './liveGatewayPendingTurn';
import { handleServerMessage } from './liveGatewayMessageProcessor';
import type { SessionRecord } from '../types';
import type { RuntimeSession } from './liveGatewayTypes';
import { getSessionUserId } from '../repositories/sessionRepository';
import { insertActivity } from './activityService';
import { broadcastEvent } from './eventService';

const INITIAL_GREETING_PROMPT = [
  'Greet the user.',
  'Pick exactly one of these three options verbatim and say nothing else:',
  '"Crewmate here. What are we building?" OR',
  '"Hey — Crewmate online. What\'s the move?" OR',
  '"Crewmate ready. What do you need?"',
].join(' ');

const RECONNECT_GREETING_PROMPT = [
  'You just reconnected after a brief connection drop.',
  'Say exactly one short natural sentence to let the user know you\'re back',
  'something like "Back with you." or "Still here — had to reconnect for a second."',
  'Be casual, brief, and reassuring. Nothing more.',
].join(' ');

function createAiClient(): GoogleGenAI {
  if (!serverConfig.geminiApiKey) {
    throw new Error('Missing GOOGLE_API_KEY or GEMINI_API_KEY for Gemini Live.');
  }

  return new GoogleGenAI({ apiKey: serverConfig.geminiApiKey });
}

function getLiveFunctionDeclarations() {
  return getSkillDeclarations({ liveOnly: true });
}

export function sendInitialGreeting(runtime: RuntimeSession): Promise<SessionRecord> {
  const sessionPromise = createPendingTurn(runtime, 30000, 'Gemini Live greeting timed out.');

  runtime.session.sendClientContent({
    turns: createUserContent(INITIAL_GREETING_PROMPT),
    turnComplete: true,
  });

  return sessionPromise;
}

function handleLifecycleServerMessage(runtime: RuntimeSession, message: LiveServerMessage): void {
  const resumptionUpdate = message.sessionResumptionUpdate;
  if (resumptionUpdate) {
    runtime.sessionResumptionHandle = resumptionUpdate.newHandle?.trim() || null;
    runtime.canResume = Boolean(resumptionUpdate.resumable && runtime.sessionResumptionHandle);
    runtime.lastConsumedClientMessageIndex = resumptionUpdate.lastConsumedClientMessageIndex?.trim() || null;
  }

  if (message.goAway && runtime.canResume && runtime.sessionResumptionHandle && !runtime.isReconnecting) {
    void reconnectGeminiLiveSession(runtime.id, `go_away:${message.goAway.timeLeft ?? 'unknown'}`);
  }
}

export async function connectGeminiSession(
  sessionId: string,
  preferences: ReturnType<typeof getUserPreferences>,
  systemInstruction: string,
  resumptionHandle?: string | null,
): Promise<{ session: Session; connectionId: string }> {
  const ai = createAiClient();
  const connectionId = randomUUID();

  const session = await ai.live.connect({
    model: selectModel('live'),
    config: buildLiveConnectConfig({
      systemInstruction,
      voiceName: preferences.voiceModel,
      functionDeclarations: getLiveFunctionDeclarations(),
      resumptionHandle,
    }),
    callbacks: {
      onmessage: (message) => {
        const current = getRuntimeSession(sessionId);
        if (!current || current.connectionId !== connectionId) {
          return;
        }

        handleLifecycleServerMessage(current, message);
        handleServerMessage(current, message);
      },
      onerror: (event) => {
        const current = getRuntimeSession(sessionId);
        if (!current || current.connectionId !== connectionId) {
          return;
        }

        const errorMessage = event?.error instanceof Error ? event.error.message : 'Gemini Live connection error.';
        if (current.canResume && current.sessionResumptionHandle && !current.isReconnecting) {
          void reconnectGeminiLiveSession(sessionId, `transport_error:${errorMessage}`);
          return;
        }

        if (current.pendingTurn) {
          current.pendingTurn.reject(new Error(errorMessage));
          clearPendingTurn(current);
        }
      },
      onclose: () => {
        const current = getRuntimeSession(sessionId);
        if (!current || current.connectionId !== connectionId) {
          return;
        }

        if (current.canResume && current.sessionResumptionHandle && !current.isReconnecting) {
          void reconnectGeminiLiveSession(sessionId, 'socket_closed');
          return;
        }

        if (current.pendingTurn) {
          current.pendingTurn.reject(new Error('Gemini Live session closed.'));
          clearPendingTurn(current);
        }
      },
    },
  });

  return { session, connectionId };
}

export async function reconnectGeminiLiveSession(sessionId: string, reason: string): Promise<void> {
  const runtime = getRuntimeSession(sessionId);
  if (!runtime || !runtime.sessionResumptionHandle || runtime.isReconnecting) {
    return;
  }

  const userId = getSessionUserId(sessionId);
  if (!userId) {
    return;
  }

  runtime.isReconnecting = true;

  try {
    const preferences = getUserPreferences(userId);
    const systemInstruction = await buildUserSystemInstruction(userId, { liveFast: true });
    const previousSession = runtime.session;
    const { session, connectionId } = await connectGeminiSession(
      sessionId,
      preferences,
      systemInstruction,
      runtime.sessionResumptionHandle,
    );

    runtime.session = session;
    runtime.connectionId = connectionId;
    runtime.isReconnecting = false;
    runtime.canResume = false;
    previousSession.close();

    try {
      runtime.session.sendClientContent({
        turns: createUserContent(RECONNECT_GREETING_PROMPT),
        turnComplete: true,
      });
    } catch {
      // Reconnect succeeded; only the spoken follow-up failed.
    }

    insertActivity(
      'Gemini Live resumed',
      `Recovered the live session after ${reason}.`,
      'observation',
      userId,
      { notify: false },
    );
    broadcastEvent(userId, 'session_update', { sessionId });
  } catch (error) {
    runtime.isReconnecting = false;
    runtime.canResume = false;
    runtime.sessionResumptionHandle = null;

    if (runtime.pendingTurn) {
      runtime.pendingTurn.reject(error instanceof Error ? error : new Error(String(error)));
      clearPendingTurn(runtime);
    }

    const failMessage = error instanceof Error ? error.message : String(error);
    insertActivity(
      'Gemini Live reconnect failed',
      failMessage,
      'note',
      userId,
      { notify: false },
    );

    broadcastEvent(userId, 'session_error', {
      sessionId,
      reason: 'reconnect_failed',
      message: 'Connection to Crewmate was lost and could not be restored. Please refresh to start a new session.',
      technicalDetail: failMessage,
    });
  }
}
