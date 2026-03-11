import { useEffect, useRef, useState, useCallback } from 'react';
import { ApiError } from '../lib/api';
import { liveSessionService } from '../services/liveSessionService';
import { useLiveEvents } from './useLiveEvents';
import type { AudioChunk, LiveSession } from '../types/live';

const AUDIO_POLL_MS = 200;

interface UseLiveSessionOptions {
  initialSession: LiveSession | null;
  onSessionChange?: () => Promise<void> | void;
}

interface UseLiveSessionResult {
  session: LiveSession | null;
  isBusy: boolean;
  error: string | null;
  elapsedLabel: string;
  isSessionActive: boolean;
  isAssistantSpeaking: boolean;
  startSession: () => Promise<LiveSession | null>;
  endSession: () => Promise<void>;
  sendMessage: (text: string, sessionIdOverride?: string) => Promise<void>;
}

export function getElapsedLabel(startedAt: string): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const mins = Math.floor(diffSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secs = (diffSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function mergeSessionState(
  initialSession: LiveSession | null,
  currentSession: LiveSession | null,
): LiveSession | null {
  if (!initialSession) {
    return currentSession;
  }

  if (!currentSession || currentSession.id !== initialSession.id) {
    return initialSession;
  }

  return {
    ...currentSession,
    ...initialSession,
    provider: initialSession.provider ?? currentSession?.provider,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function decodeBase64(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function getSampleRate(mimeType: string): number {
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : 24000;
}

function createAudioBuffer(audioContext: AudioContext, chunk: AudioChunk): AudioBuffer {
  const pcmBytes = decodeBase64(chunk.data);
  const pcm = new Int16Array(pcmBytes);
  const sampleRate = getSampleRate(chunk.mimeType);
  const buffer = audioContext.createBuffer(1, pcm.length, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let index = 0; index < pcm.length; index += 1) {
    channel[index] = pcm[index] / 0x8000;
  }

  return buffer;
}

function stopAudioSource(source: AudioBufferSourceNode | null): void {
  if (!source) {
    return;
  }

  try {
    source.stop();
  } catch {
    // Ignore stop races during interruption and teardown.
  }
}

export function useLiveSession({ initialSession, onSessionChange }: UseLiveSessionOptions): UseLiveSessionResult {
  const [session, setSession] = useState<LiveSession | null>(initialSession);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedLabel, setElapsedLabel] = useState('00:00');
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioChunk[]>([]);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingAudioRef = useRef(false);
  const lastAudioChunkIdRef = useRef(0);
  const lastPlaybackRevisionRef = useRef(0);
  const stopPollingRef = useRef(false);

  const interruptPlayback = useCallback(() => {
    audioQueueRef.current = [];
    stopAudioSource(currentSourceRef.current);
    currentSourceRef.current = null;
    isPlayingAudioRef.current = false;
    setIsAssistantSpeaking(false);
  }, []);

  useEffect(() => {
    setSession((currentSession) => mergeSessionState(initialSession, currentSession));
  }, [initialSession]);

  useEffect(() => {
    if (!session || session.status !== 'live') {
      setElapsedLabel('00:00');
      return;
    }

    setElapsedLabel(getElapsedLabel(session.startedAt));

    const interval = window.setInterval(() => {
      setElapsedLabel(getElapsedLabel(session.startedAt));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [session]);

  const refreshSession = useCallback(() => {
    if (!session?.id) return;
    void liveSessionService
      .getSession(session.id)
      .then((nextSession) => {
        stopPollingRef.current = false;
        setSession((currentSession) => ({
          ...nextSession,
          provider: nextSession.provider ?? currentSession?.provider,
        }));
      })
      .catch((pollError: unknown) => {
        if (pollError instanceof ApiError && pollError.status === 404) {
          stopPollingRef.current = true;
          setError('Live session polling route is unavailable. Restart `npm run dev:server` and start a new session.');
        }
      });
  }, [session?.id]);

  useLiveEvents({
    onSessionUpdate: (data) => {
      if (data.sessionId === session?.id) {
        refreshSession();
      }
    }
  });

  useEffect(() => {
    if (!session || session.status !== 'live') {
      lastAudioChunkIdRef.current = 0;
      lastPlaybackRevisionRef.current = 0;
      stopPollingRef.current = false;
      interruptPlayback();
      return;
    }

    const nextPlaybackRevision = session.playbackRevision ?? 0;
    if (nextPlaybackRevision !== lastPlaybackRevisionRef.current) {
      lastPlaybackRevisionRef.current = nextPlaybackRevision;
      lastAudioChunkIdRef.current = 0;
      interruptPlayback();
    }

    const audioInterval = window.setInterval(() => {
      if (stopPollingRef.current) {
        return;
      }

      void liveSessionService
        .getAudioChunks(session.id, lastAudioChunkIdRef.current)
        .then((chunks) => {
          if (chunks.length === 0) {
            return;
          }

          lastAudioChunkIdRef.current = chunks[chunks.length - 1].id;
          audioQueueRef.current.push(...chunks);
          setIsAssistantSpeaking(true);

          if (!audioContextRef.current) {
            audioContextRef.current = new window.AudioContext();
          }
          if (audioContextRef.current.state === 'suspended') {
            void audioContextRef.current.resume();
          }

          if (!isPlayingAudioRef.current && audioContextRef.current) {
            isPlayingAudioRef.current = true;
            void (async () => {
              while (audioQueueRef.current.length > 0 && audioContextRef.current) {
                const nextChunk = audioQueueRef.current.shift();
                if (nextChunk) {
                  await new Promise<void>((resolve) => {
                    const audioContext = audioContextRef.current!;
                    const source = audioContext.createBufferSource();
                    const buffer = createAudioBuffer(audioContext, nextChunk);
                    currentSourceRef.current = source;
                    source.buffer = buffer;
                    source.connect(audioContext.destination);
                    source.addEventListener('ended', () => {
                      if (currentSourceRef.current === source) {
                        currentSourceRef.current = null;
                      }
                      resolve();
                    }, { once: true });
                    source.start();
                  });
                }
              }

              window.setTimeout(() => {
                if (audioContextRef.current && !currentSourceRef.current) {
                  isPlayingAudioRef.current = false;
                  setIsAssistantSpeaking(false);
                }
              }, 120);
            })().catch((playbackError: unknown) => {
              isPlayingAudioRef.current = false;
              setIsAssistantSpeaking(false);
              setError(getErrorMessage(playbackError, 'Unable to play live audio response'));
            });
          }
        })
        .catch((pollError: unknown) => {
          if (pollError instanceof ApiError && pollError.status === 404) {
            stopPollingRef.current = true;
            setError('Live audio route is unavailable. Restart `npm run dev:server` and start a new session.');
          }
        });
    }, AUDIO_POLL_MS);

    return () => {
      window.clearInterval(audioInterval);
    };
  }, [interruptPlayback, session]);

  useEffect(() => {
    return () => {
      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      stopAudioSource(currentSourceRef.current);
      currentSourceRef.current = null;
      if (audioContext) {
        void audioContext.close();
      }
    };
  }, []);

  const startSession = async (): Promise<LiveSession | null> => {
    setIsBusy(true);
    setError(null);

    try {
      const next = await liveSessionService.start();
      if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      setSession(next);
      stopPollingRef.current = false;
      lastAudioChunkIdRef.current = 0;
      lastPlaybackRevisionRef.current = next.playbackRevision ?? 0;
      audioQueueRef.current = [];
      setIsAssistantSpeaking(false);
      await onSessionChange?.();
      return next;
    } catch (startError) {
      setError(getErrorMessage(startError, 'Unable to start session'));
      return null;
    } finally {
      setIsBusy(false);
    }
  };

  const endSession = async () => {
    if (!session) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const next = await liveSessionService.end(session.id);
      setSession(next);
      interruptPlayback();
      await onSessionChange?.();
    } catch (endError) {
      setError(getErrorMessage(endError, 'Unable to end session'));
    } finally {
      setIsBusy(false);
    }
  };

  const sendMessage = async (text: string, sessionIdOverride?: string) => {
    const targetSessionId = sessionIdOverride ?? session?.id;
    if (!targetSessionId) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const next = await liveSessionService.sendMessage(targetSessionId, text);
      setSession(next);
    } catch (messageError) {
      setError(getErrorMessage(messageError, 'Unable to send message'));
    } finally {
      setIsBusy(false);
    }
  };

  return {
    session,
    isBusy,
    error,
    elapsedLabel,
    isSessionActive: session?.status === 'live',
    isAssistantSpeaking,
    startSession,
    endSession,
    sendMessage,
  };
}
