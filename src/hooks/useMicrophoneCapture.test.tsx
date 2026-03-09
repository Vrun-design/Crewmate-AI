import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {useMicrophoneCapture} from './useMicrophoneCapture';

const {
  endAudioMock,
  sendAudioMock,
  getUserMediaMock,
  trackStopMock,
} = vi.hoisted(() => ({
  endAudioMock: vi.fn(),
  sendAudioMock: vi.fn(),
  getUserMediaMock: vi.fn(),
  trackStopMock: vi.fn(),
}));

vi.mock('../services/liveSessionService', () => ({
  liveSessionService: {
    sendAudio: sendAudioMock,
    endAudio: endAudioMock,
  },
}));

class MockScriptProcessorNode {
  public onaudioprocess: ((event: {inputBuffer: {getChannelData: (_channel: number) => Float32Array}}) => void) | null = null;

  connect(): void {}

  disconnect(): void {}
}

class MockMediaStreamSource {
  connect(_processor: MockScriptProcessorNode): void {}

  disconnect(): void {}
}

class MockAudioContext {
  public sampleRate = 48000;

  createMediaStreamSource(_stream: MediaStream): MockMediaStreamSource {
    return new MockMediaStreamSource();
  }

  createScriptProcessor(): MockScriptProcessorNode {
    const processor = new MockScriptProcessorNode();

    queueMicrotask(() => {
      processor.onaudioprocess?.({
        inputBuffer: {
          getChannelData: () => new Float32Array([0.25, -0.25, 0.5, -0.5]),
        },
      });
    });

    return processor;
  }

  async close(): Promise<void> {}
}

describe('useMicrophoneCapture', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    sendAudioMock.mockResolvedValue({ok: true});
    endAudioMock.mockResolvedValue({ok: true});

    getUserMediaMock.mockResolvedValue({
      getTracks: () => [{stop: trackStopMock}],
    });

    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: {
        getUserMedia: getUserMediaMock,
      },
      configurable: true,
    });

    vi.stubGlobal('AudioContext', MockAudioContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('auto-starts when enabled and streams PCM chunks', async () => {
    const {result} = renderHook(() =>
      useMicrophoneCapture({
        sessionId: 'SES-301',
        enabled: true,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
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

  test('mutes microphone and closes upstream audio stream', async () => {
    const {result} = renderHook(() =>
      useMicrophoneCapture({
        sessionId: 'SES-302',
        enabled: true,
      }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.status).toBe('recording');
    await act(async () => {
      await result.current.toggleMicrophone();
    });

    expect(trackStopMock).toHaveBeenCalledTimes(1);
    expect(endAudioMock).toHaveBeenCalledWith('SES-302');
    expect(result.current.status).toBe('muted');
  });
});
