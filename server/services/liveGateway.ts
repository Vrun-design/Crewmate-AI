import { randomUUID } from 'node:crypto';
import {
  FunctionDeclaration,
  GoogleGenAI,
  Modality,
  createUserContent,
  type FunctionResponse,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import {
  getSession,
  getSessionUserId,
  insertTranscriptMessage,
  updateSessionStatus,
  updateTranscriptMessage,
} from '../repositories/sessionRepository';
import { db } from '../db';
import { serverConfig } from '../config';
import { getEffectiveIntegrationConfig } from './integrationConfigService';
import { listIntegrationCatalog } from './integrationCatalog';
import { ingestLiveTurnMemory, retrieveRelevantMemories } from './memoryService';
import { getUserPreferences } from './preferencesService';
import { callTool, getToolDeclarations } from '../mcp/mcpServer';
import { broadcastEvent } from './eventService';
import { selectModel } from './modelRouter';
import { buildPersonaSystemPrompt } from './personaService';
import { insertActivity, insertTask } from './activityService';
// Ensure tools are registered by importing their modules
import './clickupService';
import './githubService';
import './notionService';
import './slackService';
import type { AudioChunkRecord, SessionRecord } from '../types';

type ToolCall = LiveServerMessage['toolCall'] extends { functionCalls?: infer T } ? T extends Array<infer U> ? U : never : never;

// Tools are now dynamically loaded from the MCP registry via getToolDeclarations()

interface PendingTurn {
  resolve: (session: SessionRecord) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface RuntimeSession {
  id: string;
  provider: 'gemini-live';
  session: Session;
  pendingTurn: PendingTurn | null;
  currentAssistantMessageId: string | null;
  currentAssistantText: string;
  currentUserTranscriptionMessageId: string | null;
  currentUserTranscriptionText: string;
  lastUserTurnText: string | null;
  hasVideoContext: boolean;
  hasAudioContext: boolean;
  audioChunks: AudioChunkRecord[];
  nextAudioChunkId: number;
  lastFrameData: { mimeType: string; data: string } | null;
  lastUserActivityTime: number;
  lastProactiveTime: number | null;
  proactiveInterval: NodeJS.Timeout | null;
}

const runtimeSessions = new Map<string, RuntimeSession>();

function createAiClient(): GoogleGenAI {
  if (!serverConfig.geminiApiKey) {
    throw new Error('Missing GOOGLE_API_KEY or GEMINI_API_KEY for Gemini Live.');
  }

  return new GoogleGenAI({ apiKey: serverConfig.geminiApiKey });
}

function clearPendingTurn(runtime: RuntimeSession): void {
  if (!runtime.pendingTurn) {
    return;
  }

  clearTimeout(runtime.pendingTurn.timer);
  runtime.pendingTurn = null;
}

function getToolErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown tool execution error';
}

function getStringArgument(call: ToolCall, key: string): string {
  return typeof call.args?.[key] === 'string' ? call.args[key] : '';
}

function getStringArrayArgument(call: ToolCall, key: string): string[] {
  const value = call.args?.[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function resolvePendingTurn(runtime: RuntimeSession): void {
  const pendingTurn = runtime.pendingTurn;
  if (!pendingTurn) {
    return;
  }

  clearPendingTurn(runtime);

  const session = getSession(runtime.id);
  if (!session) {
    pendingTurn.reject(new Error('Session state missing after model response.'));
    return;
  }

  pendingTurn.resolve({
    ...session,
    provider: 'gemini-live',
  });
}

function maybePersistTurnMemory(runtime: RuntimeSession): void {
  if (!runtime.lastUserTurnText || !runtime.currentAssistantText.trim()) {
    return;
  }

  ingestLiveTurnMemory({
    userText: runtime.lastUserTurnText,
    assistantText: runtime.currentAssistantText,
  });
}

function appendAssistantTranscript(runtime: RuntimeSession, nextText: string): void {
  const normalizedText = nextText.trim();
  if (!normalizedText) {
    return;
  }

  if (!runtime.currentAssistantMessageId) {
    runtime.currentAssistantMessageId = randomUUID();
    runtime.currentAssistantText = '';
    insertTranscriptMessage({
      id: runtime.currentAssistantMessageId,
      sessionId: runtime.id,
      role: 'agent',
      text: '',
      status: 'streaming',
    });
  }

  runtime.currentAssistantText = normalizedText;
  updateTranscriptMessage(runtime.currentAssistantMessageId, runtime.currentAssistantText, 'streaming');

  const userId = getSessionUserId(runtime.id);
  if (userId) {
    broadcastEvent(userId, 'session_update', { sessionId: runtime.id });
  }
}

function collectAudioChunks(runtime: RuntimeSession, message: LiveServerMessage): void {
  const parts = message.serverContent?.modelTurn?.parts ?? [];

  for (const part of parts) {
    const data = part.inlineData?.data?.trim();
    const mimeType = part.inlineData?.mimeType?.trim();
    if (!data || !mimeType) {
      continue;
    }

    runtime.audioChunks.push({
      id: runtime.nextAudioChunkId++,
      data,
      mimeType,
    });
  }
}

// Handled by generic activity logging below

async function handleToolCall(runtime: RuntimeSession, message: LiveServerMessage): Promise<void> {
  const calls = message.toolCall?.functionCalls ?? [];
  if (calls.length === 0) {
    return;
  }

  const userId = getSessionUserId(runtime.id);
  if (!userId) {
    throw new Error('Live session is missing its owner context.');
  }

  const frameData = runtime.lastFrameData;
  const functionResponses: FunctionResponse[] = [];

  const memberRow = db.prepare(`SELECT workspace_id as workspaceId FROM workspace_members WHERE user_id = ? LIMIT 1`).get(userId) as { workspaceId: string } | undefined;
  const workspaceId = memberRow?.workspaceId ?? '';

  for (const call of calls) {
    try {
      if (!call.name) {
        throw new Error('Tool call missing name');
      }
      const args = call.args as Record<string, unknown>;

      // Try skill registry first (Phase 2 typed skills), fall back to mcpServer (legacy)
      let output: unknown;
      const skillId = call.name?.replace(/_/g, '.') ?? '';
      const { getSkill, runSkill } = await import('../skills/registry');
      const skill = getSkill(skillId);

      if (skill) {
        const runRecord = await runSkill(skillId, { userId, workspaceId }, args);
        output = runRecord.result;
      } else {
        output = await callTool(call.name, { userId, workspaceId, frameData }, args);
      }

      insertActivity(`Executed ${call.name}`, 'Tool call executed successfully.', 'action', userId);

      functionResponses.push({
        id: call.id,
        name: call.name,
        response: { output },
      });
    } catch (error) {
      const messageText = getToolErrorMessage(error);
      insertActivity(`${call.name ?? 'Tool'} failed`, messageText, 'note', userId);
      functionResponses.push({
        id: call.id,
        name: call.name,
        response: { error: messageText },
      });
    }
  }

  runtime.session.sendToolResponse({ functionResponses });
}

function handleInputTranscription(runtime: RuntimeSession, message: LiveServerMessage): void {
  const transcriptionText = message.serverContent?.inputTranscription?.text?.trim();
  if (!transcriptionText) {
    return;
  }

  if (!runtime.currentUserTranscriptionMessageId) {
    runtime.currentUserTranscriptionMessageId = randomUUID();
    runtime.currentUserTranscriptionText = '';
    insertTranscriptMessage({
      id: runtime.currentUserTranscriptionMessageId,
      sessionId: runtime.id,
      role: 'user',
      text: '',
      status: 'streaming',
    });
  }

  runtime.currentUserTranscriptionText = transcriptionText;
  updateTranscriptMessage(runtime.currentUserTranscriptionMessageId, runtime.currentUserTranscriptionText, 'streaming');

  if (message.serverContent?.inputTranscription?.finished) {
    updateTranscriptMessage(runtime.currentUserTranscriptionMessageId, runtime.currentUserTranscriptionText, 'complete');
    runtime.lastUserTurnText = runtime.currentUserTranscriptionText;
    runtime.currentUserTranscriptionMessageId = null;
    runtime.currentUserTranscriptionText = '';
    runtime.lastUserActivityTime = Date.now();

    const userId = getSessionUserId(runtime.id);
    if (userId) {
      broadcastEvent(userId, 'session_update', { sessionId: runtime.id });
    }
  }
}

function resetAssistantTurn(runtime: RuntimeSession): void {
  runtime.currentAssistantMessageId = null;
  runtime.currentAssistantText = '';
}

function handleServerMessage(runtime: RuntimeSession, message: LiveServerMessage): void {
  handleInputTranscription(runtime, message);

  if (message.text) {
    appendAssistantTranscript(runtime, `${runtime.currentAssistantText}${message.text}`);
  }

  const outputTranscription = message.serverContent?.outputTranscription?.text;
  if (outputTranscription) {
    appendAssistantTranscript(runtime, outputTranscription);
  }

  collectAudioChunks(runtime, message);

  if (message.toolCall?.functionCalls?.length) {
    void handleToolCall(runtime, message);
  }

  if (message.serverContent?.turnComplete || message.serverContent?.generationComplete) {
    if (runtime.currentAssistantMessageId) {
      updateTranscriptMessage(runtime.currentAssistantMessageId, runtime.currentAssistantText, 'complete');
    }

    maybePersistTurnMemory(runtime);
    resetAssistantTurn(runtime);
    resolvePendingTurn(runtime);
  }
}

function createPendingTurn(runtime: RuntimeSession, timeoutMs: number, timeoutMessage: string): Promise<SessionRecord> {
  return new Promise<SessionRecord>((resolve, reject) => {
    runtime.pendingTurn = {
      resolve,
      reject,
      timer: setTimeout(() => {
        clearPendingTurn(runtime);
        reject(new Error(timeoutMessage));
      }, timeoutMs),
    };
  });
}

function sendInitialGreeting(runtime: RuntimeSession): Promise<SessionRecord> {
  const sessionPromise = createPendingTurn(runtime, 30000, 'Gemini Live greeting timed out.');

  runtime.session.sendClientContent({
    turns: createUserContent(
      'Introduce yourself as Crewmate in two concise sentences. Mention that you can analyze screens, listen to voice input, and take actions in configured tools.',
    ),
    turnComplete: true,
  });

  return sessionPromise;
}

async function buildUserSystemInstruction(userId: string): Promise<string> {
  const memberRow = db.prepare(`SELECT workspace_id as workspaceId FROM workspace_members WHERE user_id = ? LIMIT 1`).get(userId) as { workspaceId: string } | undefined;
  const workspaceId = memberRow?.workspaceId ?? '';

  // Persona-specific system prompt (the biggest differentiator)
  const personaPrompt = buildPersonaSystemPrompt(userId);

  const integrations = listIntegrationCatalog(workspaceId, userId);
  const connected = integrations
    .filter((integration) => integration.status === 'connected')
    .map((integration) => `${integration.name}: ${integration.capabilities?.join(', ') ?? integration.desc}`)
    .join('\n');

  let memoryContext = 'No relevant past memory found.';
  try {
    const memories = await retrieveRelevantMemories('Current workspace context and open tickets', 5);
    if (memories.length > 0) {
      memoryContext = memories.map((m) => `- ${m}`).join('\n');
    }
  } catch {
    // Graceful fallback if embeddings fail
  }

  return `${personaPrompt}

Be concise, concrete, and grounded in the visible screen, the live transcript, and the user's explicit intent.
Only call tools for explicit action requests. If a tool is not available, say so plainly and continue helping.

Relevant past context (Memory):
${memoryContext}

Connected integrations:
${connected || 'No external integrations are currently configured beyond the local memory brain.'}
`;
}

export async function startGeminiLiveSession(sessionId: string): Promise<SessionRecord> {
  const ai = createAiClient();
  const userId = getSessionUserId(sessionId);
  if (!userId) {
    throw new Error('Cannot start a live session without an authenticated user.');
  }

  const systemInstruction = await buildUserSystemInstruction(userId);
  updateSessionStatus(sessionId, 'connecting', null);

  const runtime = await new Promise<RuntimeSession>(async (resolve, reject) => {
    try {
      const session = await ai.live.connect({
        model: selectModel('live'),
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction,
          tools: [{ functionDeclarations: getToolDeclarations() }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede',
              },
            },
          },
        },
        callbacks: {
          onmessage: (message) => {
            const current = runtimeSessions.get(sessionId);
            if (current) {
              handleServerMessage(current, message);
            }
          },
          onerror: (event) => {
            const current = runtimeSessions.get(sessionId);
            const errorMessage = event?.error instanceof Error ? event.error.message : 'Gemini Live connection error.';
            if (current?.pendingTurn) {
              current.pendingTurn.reject(new Error(errorMessage));
              clearPendingTurn(current);
            }
          },
          onclose: () => {
            const current = runtimeSessions.get(sessionId);
            if (current?.pendingTurn) {
              current.pendingTurn.reject(new Error('Gemini Live session closed.'));
              clearPendingTurn(current);
            }
          },
        },
      });

      const created: RuntimeSession = {
        id: sessionId,
        provider: 'gemini-live',
        session,
        pendingTurn: null,
        currentAssistantMessageId: null,
        currentAssistantText: '',
        currentUserTranscriptionMessageId: null,
        currentUserTranscriptionText: '',
        lastUserTurnText: null,
        hasVideoContext: false,
        hasAudioContext: false,
        audioChunks: [],
        nextAudioChunkId: 1,
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

      runtimeSessions.set(sessionId, created);
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
  const runtime = runtimeSessions.get(sessionId);
  if (!runtime) {
    throw new Error('Live runtime not found. Start a Gemini session first.');
  }

  if (runtime.pendingTurn) {
    throw new Error('The live session is still processing the previous turn.');
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
  const runtime = runtimeSessions.get(sessionId);
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
  const runtime = runtimeSessions.get(sessionId);
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
  const runtime = runtimeSessions.get(sessionId);
  if (!runtime) {
    throw new Error('Live runtime not found. Start a Gemini session first.');
  }

  runtime.session.sendRealtimeInput({
    audioStreamEnd: true,
  });
}

export function getLiveAudioChunks(sessionId: string, afterChunkId = 0): AudioChunkRecord[] {
  const runtime = runtimeSessions.get(sessionId);
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

  const runtime = runtimeSessions.get(sessionId);
  return {
    ...session,
    provider: 'gemini-live',
    audioChunks: runtime ? [...runtime.audioChunks] : [],
  };
}

export function endGeminiLiveSession(sessionId: string): SessionRecord | null {
  const runtime = runtimeSessions.get(sessionId);
  if (runtime?.proactiveInterval) {
    clearInterval(runtime.proactiveInterval);
  }
  runtime?.session.close();
  runtimeSessions.delete(sessionId);
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
  };
}
