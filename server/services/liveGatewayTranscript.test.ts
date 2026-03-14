import { describe, expect, test } from 'vitest';
import { getAssistantTranscriptText, mergeStreamingText } from './liveGatewayTranscript';
import type { RuntimeSession } from './liveGatewayTypes';

function createRuntimeSession(overrides: Partial<RuntimeSession> = {}): RuntimeSession {
  return {
    id: 'SES-1',
    provider: 'gemini-live',
    session: {} as RuntimeSession['session'],
    connectionId: 'conn-1',
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
    lastUserActivityTime: 0,
    lastProactiveTime: null,
    proactiveInterval: null,
    pendingAnnouncements: [],
    ...overrides,
  };
}

describe('liveGatewayTranscript', () => {
  test('merges streaming transcript updates without duplicating prefixes', () => {
    const first = mergeStreamingText('', 'I can help');
    const second = mergeStreamingText(first, 'I can help with that');
    const third = mergeStreamingText(second, 'with that');

    expect(third).toBe('I can help with that');
  });

  test('prefers output transcription over model text for displayed transcript', () => {
    const runtime = createRuntimeSession({
      currentAssistantModelText: 'Short draft',
      currentAssistantOutputTranscriptionText: 'Final spoken answer',
    });

    expect(getAssistantTranscriptText(runtime)).toBe('Final spoken answer');
  });
});
