import {randomUUID} from 'node:crypto';
import {
  FunctionDeclaration,
  GoogleGenAI,
  Modality,
  createUserContent,
  type FunctionResponse,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import {serverConfig} from '../config';
import {
  getSession,
  getSessionUserId,
  insertTranscriptMessage,
  updateSessionStatus,
  updateTranscriptMessage,
} from '../repositories/sessionRepository';
import {insertActivity, insertTask} from './activityService';
import {createClickUpTask} from './clickupService';
import {createGithubIssue} from './githubService';
import {getEffectiveIntegrationConfig} from './integrationConfigService';
import {listIntegrationCatalog} from './integrationCatalog';
import {ingestLiveTurnMemory} from './memoryService';
import {createNotionPage} from './notionService';
import {postSlackMessage} from './slackService';
import type {AudioChunkRecord, SessionRecord} from '../types';

type ToolCall = LiveServerMessage['toolCall'] extends {functionCalls?: infer T} ? T extends Array<infer U> ? U : never : never;

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'create_github_issue',
    description: 'Create a GitHub issue when the user explicitly asks to file, log, or create an issue for an engineering problem.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: {type: 'string'},
        body: {type: 'string'},
        labels: {
          type: 'array',
          items: {type: 'string'},
        },
      },
      required: ['title', 'body'],
    },
  },
  {
    name: 'post_slack_message',
    description: 'Post a concise update to Slack when the user explicitly asks to notify, post, or send a summary to the team.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        text: {type: 'string'},
        channelId: {type: 'string'},
      },
      required: ['text'],
    },
  },
  {
    name: 'create_notion_page',
    description: 'Create a Notion page when the user explicitly asks to draft, write, or save a summary, PRD, or research artifact.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: {type: 'string'},
        content: {type: 'string'},
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'create_clickup_task',
    description: 'Create a ClickUp task when the user explicitly asks to log, create, or track follow-up work or a bug.',
    parametersJsonSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {type: 'string'},
        description: {type: 'string'},
      },
      required: ['name', 'description'],
    },
  },
];

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
}

const runtimeSessions = new Map<string, RuntimeSession>();

function createAiClient(): GoogleGenAI {
  if (!serverConfig.geminiApiKey) {
    throw new Error('Missing GOOGLE_API_KEY or GEMINI_API_KEY for Gemini Live.');
  }

  return new GoogleGenAI({apiKey: serverConfig.geminiApiKey});
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

async function executeToolCall(userId: string, call: ToolCall): Promise<unknown> {
  if (call.name === 'create_github_issue') {
    return createGithubIssue(userId, {
      title: getStringArgument(call, 'title'),
      body: getStringArgument(call, 'body'),
      labels: getStringArrayArgument(call, 'labels'),
    });
  }

  if (call.name === 'post_slack_message') {
    return postSlackMessage(userId, {
      text: getStringArgument(call, 'text'),
      channelId: getStringArgument(call, 'channelId') || undefined,
    });
  }

  if (call.name === 'create_notion_page') {
    return createNotionPage(userId, {
      title: getStringArgument(call, 'title'),
      content: getStringArgument(call, 'content'),
    });
  }

  if (call.name === 'create_clickup_task') {
    return createClickUpTask(userId, {
      name: getStringArgument(call, 'name'),
      description: getStringArgument(call, 'description'),
    });
  }

  throw new Error(`Unsupported tool call: ${call.name ?? 'unknown'}`);
}

function recordToolSuccess(userId: string, call: ToolCall, output: unknown): void {
  if (call.name === 'create_github_issue') {
    const issue = output as {issueNumber: number; title: string};
    const config = getEffectiveIntegrationConfig(userId, 'github');
    insertTask(`Created GitHub issue #${issue.issueNumber}: ${issue.title}`, 'GitHub');
    insertActivity('GitHub issue created', `Opened issue #${issue.issueNumber} in ${config.repoOwner}/${config.repoName}.`, 'action');
    return;
  }

  if (call.name === 'post_slack_message') {
    insertTask('Posted live update to Slack', 'Slack');
    insertActivity('Slack update posted', 'Delivered a live status update to the configured Slack channel.', 'communication');
    return;
  }

  if (call.name === 'create_notion_page') {
    const page = output as {title: string};
    insertTask(`Created Notion page: ${page.title}`, 'Notion');
    insertActivity('Notion page created', `Saved a live session artifact to Notion: ${page.title}.`, 'action');
    return;
  }

  if (call.name === 'create_clickup_task') {
    const task = output as {name: string};
    insertTask(`Created ClickUp task: ${task.name}`, 'ClickUp');
    insertActivity('ClickUp task created', `Logged a new ClickUp task from the live session: ${task.name}.`, 'action');
  }
}

function recordToolFailure(call: ToolCall, messageText: string): void {
  if (call.name === 'create_github_issue') {
    insertActivity('GitHub issue failed', messageText, 'note');
    return;
  }

  if (call.name === 'post_slack_message') {
    insertActivity('Slack update failed', messageText, 'note');
    return;
  }

  if (call.name === 'create_notion_page') {
    insertActivity('Notion page failed', messageText, 'note');
    return;
  }

  if (call.name === 'create_clickup_task') {
    insertActivity('ClickUp task failed', messageText, 'note');
  }
}

async function handleToolCall(runtime: RuntimeSession, message: LiveServerMessage): Promise<void> {
  const calls = message.toolCall?.functionCalls ?? [];
  if (calls.length === 0) {
    return;
  }

  const userId = getSessionUserId(runtime.id);
  if (!userId) {
    throw new Error('Live session is missing its owner context.');
  }

  const functionResponses: FunctionResponse[] = [];

  for (const call of calls) {
    try {
      const output = await executeToolCall(userId, call);
      recordToolSuccess(userId, call, output);
      functionResponses.push({
        id: call.id,
        name: call.name,
        response: {output},
      });
    } catch (error) {
      const messageText = getToolErrorMessage(error);
      recordToolFailure(call, messageText);
      functionResponses.push({
        id: call.id,
        name: call.name,
        response: {error: messageText},
      });
    }
  }

  runtime.session.sendToolResponse({functionResponses});
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

function buildUserSystemInstruction(userId: string): string {
  const integrations = listIntegrationCatalog(userId);
  const connected = integrations
    .filter((integration) => integration.status === 'connected')
    .map((integration) => `${integration.name}: ${integration.capabilities?.join(', ') ?? integration.desc}`)
    .join('\n');

  return `
You are Crewmate, a live AI product operator helping a founder or PM.
Be concise, concrete, and grounded in the visible screen, the live transcript, and the user's explicit intent.
Only call tools for explicit action requests.
If a tool is not available, say so plainly and continue helping.
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
  updateSessionStatus(sessionId, 'connecting', null);

  const runtime = await new Promise<RuntimeSession>(async (resolve, reject) => {
    try {
      const session = await ai.live.connect({
        model: serverConfig.geminiLiveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: buildUserSystemInstruction(userId),
          tools: [{functionDeclarations}],
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
      };

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
  insertTranscriptMessage({
    id: randomUUID(),
    sessionId,
    role: 'user',
    text,
    status: 'complete',
  });

  const responsePromise = createPendingTurn(runtime, 45000, 'Gemini Live response timed out.');
  runtime.session.sendClientContent({
    turns: createUserContent(text),
    turnComplete: true,
  });

  return responsePromise;
}

export function sendLiveVideoFrame(sessionId: string, input: {mimeType: string; data: string}): void {
  const runtime = runtimeSessions.get(sessionId);
  if (!runtime) {
    throw new Error('Live runtime not found. Start a Gemini session first.');
  }

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

export function sendLiveAudioChunk(sessionId: string, input: {mimeType: string; data: string}): void {
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
  runtime?.session.close();
  runtimeSessions.delete(sessionId);
  updateSessionStatus(sessionId, 'ended', new Date().toISOString());

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
