import { randomUUID } from 'node:crypto';
import type { LiveServerMessage } from '@google/genai';
import { db } from '../db';
import { getSessionUserId, insertTranscriptMessage, updateTranscriptMessage } from '../repositories/sessionRepository';
import { broadcastEvent } from './eventService';
import { ingestLiveTurnMemory } from './memoryService';
import { clearPendingTurn, resolvePendingTurn } from './liveGatewayPendingTurn';
import { handleToolCall } from './liveGatewayToolRunner';
import type { RuntimeSession } from './liveGatewayTypes';

function maybePersistTurnMemory(runtime: RuntimeSession): void {
  const userId = getSessionUserId(runtime.id);
  if (!userId || !runtime.lastUserTurnText || !runtime.currentAssistantText.trim()) {
    return;
  }

  const memberRow = db
    .prepare('SELECT workspace_id as workspaceId FROM workspace_members WHERE user_id = ? LIMIT 1')
    .get(userId) as { workspaceId: string } | undefined;

  ingestLiveTurnMemory({
    userId,
    workspaceId: memberRow?.workspaceId,
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

export function handleServerMessage(runtime: RuntimeSession, message: LiveServerMessage): void {
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
