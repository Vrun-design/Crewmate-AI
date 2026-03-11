import { randomUUID } from 'node:crypto';
import {
  GoogleGenAI,
  createUserContent,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import { getSession, getSessionUserId, insertTranscriptMessage, updateSessionStatus } from '../repositories/sessionRepository';
import { serverConfig } from '../config';
import { getUserPreferences } from './preferencesService';
import { getToolDeclarations } from '../mcp/mcpServer';
import { getSkillDeclarations } from '../skills/registry';
import { broadcastEvent } from './eventService';
import { selectModel } from './modelRouter';
import { insertActivity } from './activityService';
import { buildLiveConnectConfig } from './liveGatewayConfig';
import { buildUserSystemInstruction } from './liveGatewayPromptBuilder';
import { getRuntimeSession, setRuntimeSession, deleteRuntimeSession } from './liveGatewayRuntimeStore';
import { createPendingTurn, clearPendingTurn } from './liveGatewayPendingTurn';
import { handleServerMessage } from './liveGatewayMessageProcessor';
// Ensure tools are registered by importing their modules
import './clickupService';
import './githubService';
import './notionService';
import './slackService';
import './telegramService';
import './workspaceTaskTool';
import type { AudioChunkRecord, SessionRecord } from '../types';
import type { RuntimeSession } from './liveGatewayTypes';

function createAiClient(): GoogleGenAI {
  if (!serverConfig.geminiApiKey) {
    throw new Error('Missing GOOGLE_API_KEY or GEMINI_API_KEY for Gemini Live.');
  }

  return new GoogleGenAI({ apiKey: serverConfig.geminiApiKey });
}

function sendInitialGreeting(runtime: RuntimeSession): Promise<SessionRecord> {
  const sessionPromise = createPendingTurn(runtime, 30000, 'Gemini Live greeting timed out.');

  runtime.session.sendClientContent({
    turns: createUserContent('Say: "Hey, how can I help?" Keep it short and natural.'),
    turnComplete: true,
  });

  return sessionPromise;
}

function getLiveFunctionDeclarations() {
  return [
    ...getToolDeclarations({ liveOnly: true }),
    ...getSkillDeclarations({ liveOnly: true }),
  ];
}

async function connectGeminiSession(
  sessionId: string,
  userId: string,
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

async function reconnectGeminiLiveSession(sessionId: string, reason: string): Promise<void> {
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
    const systemInstruction = await buildUserSystemInstruction(userId);
    const previousSession = runtime.session;
    const { session, connectionId } = await connectGeminiSession(
      sessionId,
      userId,
      preferences,
      systemInstruction,
      runtime.sessionResumptionHandle,
    );

    runtime.session = session;
    runtime.connectionId = connectionId;
    runtime.isReconnecting = false;
    runtime.canResume = false;
    previousSession.close();

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

    insertActivity(
      'Gemini Live reconnect failed',
      error instanceof Error ? error.message : String(error),
      'note',
      userId,
      { notify: false },
    );
  }
}

export async function startGeminiLiveSession(sessionId: string): Promise<SessionRecord> {
  const userId = getSessionUserId(sessionId);
  if (!userId) {
    throw new Error('Cannot start a live session without an authenticated user.');
  }

  const preferences = getUserPreferences(userId);
  const systemInstruction = await buildUserSystemInstruction(userId);
  updateSessionStatus(sessionId, 'connecting', null);

  const runtime = await new Promise<RuntimeSession>(async (resolve, reject) => {
    try {
      const { session, connectionId } = await connectGeminiSession(
        sessionId,
        userId,
        preferences,
        systemInstruction,
      );

      const created: RuntimeSession = {
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

      created.proactiveInterval = setInterval(() => {
        if (!created.hasVideoContext) return;

        const now = Date.now();
        // Check for 5 minutes of inactivity
        if (now - created.lastUserActivityTime > 5 * 60 * 1000) {
          // Avoid firing again if it already fired recently
          if (created.lastProactiveTime && (now - created.lastProactiveTime) < 5 * 60 * 1000) return;

          const prefs = getUserPreferences(userId);
          if (!prefs.proactiveSuggestions) return;

          created.lastProactiveTime = now;
          created.session.sendClientContent({
            turns: createUserContent('Silently analyze the current screen and proactively flag any issues, blockers, or things I should know about.'),
            turnComplete: true,
          });
          insertActivity('Proactive analysis', 'Triggered a background screen analysis due to user inactivity.', 'observation', userId);
        }
      }, 30000); // Check every 30s

      setRuntimeSession(sessionId, created);
      resolve(created);
    } catch (error) {
      reject(error);
    }
  });

  updateSessionStatus(sessionId, 'live', null);
  insertActivity('Gemini Live connected', 'The dashboard is now backed by a real Gemini Live session.', 'observation');

  return sendInitialGreeting(runtime);
}

export async function sendLiveMessage(sessionId: string, text: string): Promise<SessionRecord> {
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

  runtime.session.sendRealtimeInput({
    video: {
      mimeType: input.mimeType,
      data: input.data,
    },
  });

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

  runtime.session.sendRealtimeInput({
    audio: {
      mimeType: input.mimeType,
      data: input.data,
    },
  });

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

  runtime.session.sendRealtimeInput({
    audioStreamEnd: true,
  });
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
    audioChunks: runtime ? [...runtime.audioChunks] : [],
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
