import {act, renderHook, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {useLiveSession} from './useLiveSession';

const {startMock, endMock, sendMessageMock, getSessionMock, getAudioChunksMock} = vi.hoisted(() => ({
  startMock: vi.fn(),
  endMock: vi.fn(),
  sendMessageMock: vi.fn(),
  getSessionMock: vi.fn(),
  getAudioChunksMock: vi.fn(),
}));

vi.mock('../services/liveSessionService', () => ({
  liveSessionService: {
    start: startMock,
    end: endMock,
    sendMessage: sendMessageMock,
    getSession: getSessionMock,
    getAudioChunks: getAudioChunksMock,
  },
}));

const baseSession = {
  id: 'SES-100',
  status: 'live' as const,
  startedAt: '2026-03-09T10:00:00.000Z',
  endedAt: null,
  transcript: [],
  provider: 'gemini-live' as const,
};

describe('useLiveSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(baseSession);
    getAudioChunksMock.mockResolvedValue([]);
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running';

        async resume(): Promise<void> {}

        async close(): Promise<void> {}

        createBuffer() {
          return {
            getChannelData: () => new Float32Array(0),
          };
        }

        createBufferSource() {
          return {
            connect() {},
            addEventListener(_event: string, listener: () => void) {
              queueMicrotask(listener);
            },
            start() {},
            buffer: null,
          };
        }

        destination = {};
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('starts a live session and updates state', async () => {
    startMock.mockResolvedValue(baseSession);

    const onSessionChange = vi.fn();
    const {result} = renderHook(() =>
      useLiveSession({
        initialSession: null,
        onSessionChange,
      }),
    );

    await act(async () => {
      await result.current.startSession();
    });

    await waitFor(() => {
      expect(result.current.session?.id).toBe('SES-100');
    });
    expect(onSessionChange).toHaveBeenCalledTimes(1);
  });

  test('sends a message through the active session', async () => {
    sendMessageMock.mockResolvedValue({
      ...baseSession,
      transcript: [{id: 'MSG-1', role: 'user' as const, text: 'Hello'}],
    });

    const {result} = renderHook(() =>
      useLiveSession({
        initialSession: baseSession,
      }),
    );

    await act(async () => {
      await result.current.sendMessage('Hello');
    });

    expect(sendMessageMock).toHaveBeenCalledWith('SES-100', 'Hello');
    expect(result.current.session?.transcript).toHaveLength(1);
  });

  test('surfaces service errors', async () => {
    startMock.mockRejectedValue(new Error('boom'));

    const {result} = renderHook(() =>
      useLiveSession({
        initialSession: null,
      }),
    );

    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.error).toBe('boom');
  });
});
