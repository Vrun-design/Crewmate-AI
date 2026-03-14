import { liveSessionService } from '../services/liveSessionService';
import type { LiveToolCall, TranscriptMessage } from '../types/live';
import { getErrorMessage, mergeStreamingText, normalizeText } from './liveSessionUtils';

type DirectMessageRecord = Record<string, any>;

interface HandleDirectMessageOptions {
  message: DirectMessageRecord;
  directAssistantTextRef: React.MutableRefObject<string>;
  directAudioChunkIdRef: React.MutableRefObject<number>;
  directSessionRef: React.MutableRefObject<{ sendToolResponse: (payload: { functionResponses: unknown[] }) => void } | null>;
  directUserTextRef: React.MutableRefObject<string>;
  sessionIdRef: React.MutableRefObject<string | null>;
  prepareToolCalls?: (calls: LiveToolCall[]) => Promise<LiveToolCall[]>;
  applyDirectTranscript: (
    role: TranscriptMessage['role'],
    text: string,
    status: TranscriptMessage['status'],
  ) => void;
  interruptPlayback: () => void;
  persistCompletedTurn: (userText: string, assistantText: string) => Promise<void>;
  queueAudioChunk: (chunk: { id: number; data: string; mimeType: string }) => void;
  setError: (message: string) => void;
  incrementPlaybackRevision: () => void;
  onTurnComplete?: () => void;
}

function mapFunctionCalls(functionCalls: DirectMessageRecord[]): LiveToolCall[] {
  return functionCalls.map((call) => ({
    id: typeof call.id === 'string' ? call.id : undefined,
    name: typeof call.name === 'string' ? call.name : undefined,
    args: typeof call.args === 'object' && call.args !== null ? call.args as Record<string, unknown> : {},
  }));
}

export async function handleDirectLiveMessage({
  message,
  directAssistantTextRef,
  directAudioChunkIdRef,
  directSessionRef,
  directUserTextRef,
  sessionIdRef,
  prepareToolCalls,
  applyDirectTranscript,
  interruptPlayback,
  persistCompletedTurn,
  queueAudioChunk,
  setError,
  incrementPlaybackRevision,
  onTurnComplete,
}: HandleDirectMessageOptions): Promise<void> {
  const inputTranscription = message.serverContent?.inputTranscription?.text;
  if (typeof inputTranscription === 'string' && inputTranscription.trim()) {
    directUserTextRef.current = inputTranscription.trim();
    applyDirectTranscript(
      'user',
      directUserTextRef.current,
      message.serverContent?.inputTranscription?.finished ? 'complete' : 'streaming',
    );
  }

  if (typeof message.text === 'string' && message.text.trim()) {
    directAssistantTextRef.current = mergeStreamingText(directAssistantTextRef.current, message.text);
    applyDirectTranscript('agent', directAssistantTextRef.current, 'streaming');
  }

  const outputTranscription = message.serverContent?.outputTranscription?.text;
  if (typeof outputTranscription === 'string' && outputTranscription.trim()) {
    directAssistantTextRef.current = mergeStreamingText(directAssistantTextRef.current, outputTranscription);
    applyDirectTranscript('agent', directAssistantTextRef.current, 'streaming');
  }

  const parts = Array.isArray(message.serverContent?.modelTurn?.parts)
    ? message.serverContent.modelTurn.parts
    : [];
  for (const part of parts) {
    const data = typeof part?.inlineData?.data === 'string' ? part.inlineData.data.trim() : '';
    const mimeType = typeof part?.inlineData?.mimeType === 'string' ? part.inlineData.mimeType.trim() : '';
    if (!data || !mimeType) {
      continue;
    }

    directAudioChunkIdRef.current += 1;
    queueAudioChunk({
      id: directAudioChunkIdRef.current,
      data,
      mimeType,
    });
  }

  const functionCalls = Array.isArray(message.toolCall?.functionCalls) ? message.toolCall.functionCalls : [];
  if (functionCalls.length > 0 && sessionIdRef.current && directSessionRef.current) {
    try {
      const mappedCalls = mapFunctionCalls(functionCalls);
      const preparedCalls = prepareToolCalls ? await prepareToolCalls(mappedCalls) : mappedCalls;
      const response = await liveSessionService.executeToolCalls(sessionIdRef.current, preparedCalls);
      directSessionRef.current.sendToolResponse({
        functionResponses: response.functionResponses,
      });
    } catch (toolError) {
      setError(getErrorMessage(toolError, 'Unable to execute live tool call'));
    }
  }

  if (message.serverContent?.interrupted) {
    interruptPlayback();
    directAudioChunkIdRef.current = 0;
    incrementPlaybackRevision();
  }

  if (message.serverContent?.turnComplete || message.serverContent?.generationComplete) {
    const finalAssistantText = normalizeText(directAssistantTextRef.current);
    if (finalAssistantText) {
      applyDirectTranscript('agent', finalAssistantText, 'complete');
    }
    await persistCompletedTurn(normalizeText(directUserTextRef.current), finalAssistantText);
    directAssistantTextRef.current = '';
    directUserTextRef.current = '';
    directAudioChunkIdRef.current = 0;
    onTurnComplete?.();
  }
}
