import type { LiveServerMessage } from '@google/genai';
import { updateTranscriptMessage } from '../repositories/sessionRepository';
import { getAssistantTranscriptText, mergeStreamingText } from './liveGatewayTranscript';
import { clearPendingTurn, resolvePendingTurn } from './liveGatewayPendingTurn';
import { flushPendingAnnouncements } from './liveGatewayAnnouncements';
import {
  collectAudioChunks,
  handleInputTranscription,
  handleInterruptedPlayback,
  maybePersistTurnMemory,
  resetAssistantTurn,
  syncAssistantTranscript,
} from './liveGatewayMessageHelpers';
import { handleToolCall } from './liveGatewayToolRunner';
import type { RuntimeSession } from './liveGatewayTypes';

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
    flushPendingAnnouncements(runtime);
  }
}
