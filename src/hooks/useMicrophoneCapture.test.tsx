import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useMicrophoneCapture } from './useMicrophoneCapture';

interface MockAudioWorkletMessageEvent {
  data: Float32Array;
}

const {
  endAudioMock,
  sendAudioMock,
  getUserMediaMock,
  trackStopMock,
  workletNodes,
} = vi.hoisted(() => ({
  endAudioMock: vi.fn(),
  sendAudioMock: vi.fn(),
  getUserMediaMock: vi.fn(),
  trackStopMock: vi.fn(),
  workletNodes: [] as Array<{ port: { onmessage: ((event: MockAudioWorkletMessageEvent) => void) | null } }>,
}));

vi.mock('../services/liveSessionService', () => ({
  liveSessionService: {
    sendAudio: sendAudioMock,
    endAudio: endAudioMock,
  },
}));

class MockMediaStreamSource {
  connect(): void {}
  disconnect(): void {}
}

class MockAudioContext {
  public sampleRate = 48000;
  public audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  public destination = {};

  createMediaStreamSource(_stream: MediaStream): MockMediaStreamSource {
    return new MockMediaStreamSource();
  }

  async close(): Promise<void> {}
}

function emitAudioChunk(level = 0.5): Float32Array {
  return new Float32Array([level, -level, level, -level]);
}

describe('useMicrophoneCapture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    workletNodes.length = 0;
    sendAudioMock.mockResolvedValue({ ok: true });
    endAudioMock.mockResolvedValue({ ok: true });

    getUserMediaMock.mockResolvedValue({
      getTracks: () => [{ stop: trackStopMock }],
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getUserMedia: getUserMediaMock,
      },
      configurable: true,
    });

    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('AudioWorkletNode', class {
      port: { onmessage: ((event: MockAudioWorkletMessageEvent) => void) | null } = { onmessage: null };
      constructor() {
        workletNodes.push(this);
      }
      connect() {}
      disconnect() {}
    });
    vi.stubGlobal('AudioWorklet', {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('starts explicitly and streams PCM chunks continuously', async () => {
    const { result } = renderHook(() =>
      useMicrophoneCapture({
        sessionId: 'SES-301',
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startMicrophone();
      workletNodes.at(-1)?.port.onmessage?.({ data: emitAudioChunk() });
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(result.current.status).toBe('recording');
    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    expect(sendAudioMock).toHaveBeenCalledWith(
      'SES-301',
      expect.objectContaining({
        mimeType: 'audio/pcm;rate=16000',
      }),
    );
  });

  test('mutes microphone and closes the upstream audio stream once', async () => {
    const { result } = renderHook(() =>
      useMicrophoneCapture({
        sessionId: 'SES-302',
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startMicrophone();
      workletNodes.at(-1)?.port.onmessage?.({ data: emitAudioChunk() });
      await vi.advanceTimersByTimeAsync(150);
    });

    await act(async () => {
      await result.current.toggleMicrophone();
    });

    expect(trackStopMock).toHaveBeenCalledTimes(1);
    expect(endAudioMock).toHaveBeenCalledWith('SES-302');
    expect(result.current.status).toBe('muted');
  });

  test('keeps streaming while enabled instead of closing each speech turn', async () => {
    const { result } = renderHook(() =>
      useMicrophoneCapture({
        sessionId: 'SES-303',
        enabled: true,
      }),
    );

    await act(async () => {
      await result.current.startMicrophone();
      workletNodes.at(-1)?.port.onmessage?.({ data: emitAudioChunk() });
      await vi.advanceTimersByTimeAsync(400);
      workletNodes.at(-1)?.port.onmessage?.({ data: emitAudioChunk(0.3) });
      await vi.advanceTimersByTimeAsync(400);
    });

    expect(sendAudioMock).toHaveBeenCalled();
    expect(endAudioMock).not.toHaveBeenCalled();
    expect(result.current.status).toBe('recording');
  });
});
