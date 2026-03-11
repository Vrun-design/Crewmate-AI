import { randomUUID } from 'node:crypto';
import type { LiveServerMessage } from '@google/genai';
import { db } from '../db';
import { getSessionUserId, insertTranscriptMessage, updateTranscriptMessage } from '../repositories/sessionRepository';
import { broadcastEvent } from './eventService';
import { getAssistantTranscriptText, mergeStreamingText } from './liveGatewayTranscript';
import { ingestLiveTurnMemory } from './memoryService';
import { clearPendingTurn, resolvePendingTurn } from './liveGatewayPendingTurn';
import { handleToolCall } from './liveGatewayToolRunner';
import type { RuntimeSession } from './liveGatewayTypes';

function maybePersistTurnMemory(runtime: RuntimeSession): void {
  const userId = getSessionUserId(runtime.id);
  const assistantText = getAssistantTranscriptText(runtime);
  if (!userId || !runtime.lastUserTurnText || !assistantText) {
    return;
  }

  const memberRow = db
    .prepare('SELECT workspace_id as workspaceId FROM workspace_members WHERE user_id = ? LIMIT 1')
    .get(userId) as { workspaceId: string } | undefined;

  ingestLiveTurnMemory({
    userId,
    workspaceId: memberRow?.workspaceId,
    userText: runtime.lastUserTurnText,
    assistantText,
  });
}

function ensureAssistantTranscript(runtime: RuntimeSession): void {
  if (!runtime.currentAssistantMessageId) {
    runtime.currentAssistantMessageId = randomUUID();
    insertTranscriptMessage({
      id: runtime.currentAssistantMessageId,
      sessionId: runtime.id,
      role: 'agent',
      text: '',
      status: 'streaming',
    });
  }
}

function syncAssistantTranscript(runtime: RuntimeSession): void {
  const nextText = getAssistantTranscriptText(runtime);
  if (!nextText) {
    return;
  }

  ensureAssistantTranscript(runtime);
  updateTranscriptMessage(runtime.currentAssistantMessageId!, nextText, 'streaming');

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

    const signature = `${mimeType}:${data.length}:${data.slice(0, 48)}`;
    if (runtime.lastAudioChunkSignature === signature) {
      continue;
    }

    runtime.lastAudioChunkSignature = signature;
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
  runtime.currentAssistantModelText = '';
  runtime.currentAssistantOutputTranscriptionText = '';
  runtime.lastAudioChunkSignature = null;
}

function handleInterruptedPlayback(runtime: RuntimeSession): void {
  runtime.playbackRevision += 1;
  runtime.audioChunks = [];
  runtime.nextAudioChunkId = 1;
  runtime.lastAudioChunkSignature = null;

  const userId = getSessionUserId(runtime.id);
  if (userId) {
    broadcastEvent(userId, 'session_update', { sessionId: runtime.id });
  }
}

export function handleServerMessage(runtime: RuntimeSession, message: LiveServerMessage): void {
  handleInputTranscription(runtime, message);

  if (message.text) {
    runtime.currentAssistantModelText = mergeStreamingText(runtime.currentAssistantModelText, message.text);
    syncAssistantTranscript(runtime);
  }

  const outputTranscription = message.serverContent?.outputTranscription?.text;
  if (outputTranscription) {
    runtime.currentAssistantOutputTranscriptionText = mergeStreamingText(
      runtime.currentAssistantOutputTranscriptionText,
      outputTranscription,
    );
    syncAssistantTranscript(runtime);
  }

  collectAudioChunks(runtime, message);

  if (message.toolCall?.functionCalls?.length) {
    void handleToolCall(runtime, message);
  }

  if (message.serverContent?.interrupted) {
    handleInterruptedPlayback(runtime);
  }

  if (message.serverContent?.turnComplete || message.serverContent?.generationComplete) {
    if (runtime.currentAssistantMessageId) {
      updateTranscriptMessage(runtime.currentAssistantMessageId, getAssistantTranscriptText(runtime), 'complete');
    }

    maybePersistTurnMemory(runtime);
    resetAssistantTurn(runtime);
    resolvePendingTurn(runtime);
  }
}
