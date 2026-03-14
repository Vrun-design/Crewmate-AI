import { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, createUserContent, type Session } from '@google/genai';
import { ApiError } from '../lib/api';
import { liveSessionService } from '../services/liveSessionService';
import { createAudioBuffer, stopAudioSource } from './liveSessionAudio';
import { handleDirectLiveMessage } from './liveSessionDirect';
import {
  getElapsedLabel,
  getErrorMessage,
  mergeSessionState,
  mergeStreamingText,
  normalizeText,
  upsertTranscript,
} from './liveSessionUtils';
import { useLiveEvents } from './useLiveEvents';
import type { AudioChunk, LiveSession, LiveToolCall, TranscriptMessage } from '../types/live';

const AUDIO_POLL_MS = 200;
const DIRECT_CLIENT_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? import.meta.env.VITE_GOOGLE_API_KEY ?? '';
const DIRECT_LIVE_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DIRECT_LIVE === 'true';
const CAN_USE_DIRECT_LIVE = DIRECT_LIVE_ENABLED && Boolean(DIRECT_CLIENT_API_KEY);

interface UseLiveSessionOptions {
  initialSession: LiveSession | null;
  onSessionChange?: () => Promise<void> | void;
  eventsEnabled?: boolean;
  prepareToolCalls?: (calls: LiveToolCall[]) => Promise<LiveToolCall[]>;
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
  sendAudioChunk: (payload: { mimeType: string; data: string }) => Promise<void>;
  endAudioInput: () => Promise<void>;
  sendVideoFrame: (payload: { mimeType: string; data: string }) => Promise<void>;
}

type TransportMode = 'relay' | 'direct' | null;

function buildAnnouncementPrompt(
  intro: string,
  taskTitle: string,
  detailLabel: 'Reason' | 'Result',
  detail: string,
): string {
  return [
    intro,
    'Reply in exactly one short spoken sentence.',
    `Task: "${taskTitle}"`,
    detail ? `${detailLabel}: "${detail}"` : '',
    'Do not ask a follow-up question.',
  ].filter(Boolean).join('\n');
}

function buildLiveTaskAnnouncementPrompt(
  title: string,
  status: 'completed' | 'failed',
  summary?: string | null,
): string {
  const taskTitle = title.slice(0, 140);
  const detail = (summary ?? '').slice(0, 220);

  if (status === 'failed') {
    return buildAnnouncementPrompt(
      'A background task you started for the user has failed. Say that it failed, mention the task briefly, and include the reason if it is useful.',
      taskTitle,
      'Reason',
      detail,
    );
  }

  return buildAnnouncementPrompt(
    'A background task you started for the user has completed. Say that it is done, mention the task briefly, and include the key result if it is useful.',
    taskTitle,
    'Result',
    detail,
  );
}

export function useLiveSession({ initialSession, onSessionChange, eventsEnabled = true, prepareToolCalls }: UseLiveSessionOptions): UseLiveSessionResult {
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
  const isAudioPollingRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directSessionRef = useRef<Session | null>(null);
  const transportModeRef = useRef<TransportMode>(null);
  const directAudioChunkIdRef = useRef(0);
  const directAssistantTextRef = useRef('');
  const directUserTextRef = useRef('');
  const directAnnouncementQueueRef = useRef<string[]>([]);
  const isDirectTurnActiveRef = useRef(false);
  const sessionIdRef = useRef<string | null>(initialSession?.id ?? null);

  const ensureAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  const interruptPlayback = useCallback(() => {
    audioQueueRef.current = [];
    stopAudioSource(currentSourceRef.current);
    currentSourceRef.current = null;
    isPlayingAudioRef.current = false;
    setIsAssistantSpeaking(false);
  }, []);

  const queueAudioChunk = useCallback((chunk: AudioChunk) => {
    audioQueueRef.current.push(chunk);
    setIsAssistantSpeaking(true);

    void ensureAudioContext().then(() => {
      if (!audioContextRef.current || isPlayingAudioRef.current) {
        return;
      }

      isPlayingAudioRef.current = true;
      void (async () => {
        while (audioQueueRef.current.length > 0 && audioContextRef.current) {
          const nextChunk = audioQueueRef.current.shift();
          if (!nextChunk) {
            continue;
          }

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

        window.setTimeout(() => {
          if (audioContextRef.current && !currentSourceRef.current) {
            isPlayingAudioRef.current = false;
            setIsAssistantSpeaking(false);
          }
        }, 80);
      })().catch((playbackError: unknown) => {
        isPlayingAudioRef.current = false;
        setIsAssistantSpeaking(false);
        setError(getErrorMessage(playbackError, 'Unable to play live audio response'));
      });
    }).catch((audioError: unknown) => {
      setError(getErrorMessage(audioError, 'Unable to initialize live audio playback'));
    });
  }, [ensureAudioContext]);

  const sendDirectPrompt = useCallback((prompt: string) => {
    if (!directSessionRef.current) {
      return;
    }

    isDirectTurnActiveRef.current = true;
    directSessionRef.current.sendClientContent({
      turns: createUserContent(prompt),
      turnComplete: true,
    });
  }, []);

  const flushDirectAnnouncementQueue = useCallback(() => {
    if (isDirectTurnActiveRef.current || !directSessionRef.current || directAnnouncementQueueRef.current.length === 0) {
      return;
    }

    const nextPrompt = directAnnouncementQueueRef.current.shift();
    if (!nextPrompt) {
      return;
    }

    sendDirectPrompt(nextPrompt);
  }, [sendDirectPrompt]);

  const enqueueDirectAnnouncement = useCallback((prompt: string) => {
    if (isDirectTurnActiveRef.current) {
      directAnnouncementQueueRef.current.push(prompt);
      return;
    }

    sendDirectPrompt(prompt);
  }, [sendDirectPrompt]);

  const persistCompletedTurn = useCallback(async (userText: string, assistantText: string) => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId || (!userText && !assistantText)) {
      return;
    }

    try {
      const nextSession = await liveSessionService.persistTurn(currentSessionId, {
        userText: userText || undefined,
        assistantText: assistantText || undefined,
      });
      setSession((currentSession) => ({
        ...nextSession,
        provider: currentSession?.provider ?? nextSession.provider,
      }));
      await onSessionChange?.();
    } catch (persistError) {
      setError(getErrorMessage(persistError, 'Unable to persist live turn'));
    }
  }, [onSessionChange]);

  const applyDirectTranscript = useCallback((role: TranscriptMessage['role'], text: string, status: TranscriptMessage['status']) => {
    setSession((currentSession) => {
      if (!currentSession) {
        return currentSession;
      }

      return {
        ...currentSession,
        transcript: upsertTranscript(currentSession.transcript, role, text, status),
      };
    });
  }, []);

  const handleDirectMessage = useCallback(async (message: Record<string, any>) => {
    await handleDirectLiveMessage({
      message,
      directAssistantTextRef,
      directAudioChunkIdRef,
      directSessionRef: directSessionRef as React.MutableRefObject<{ sendToolResponse: (payload: { functionResponses: unknown[] }) => void } | null>,
      directUserTextRef,
      sessionIdRef,
      prepareToolCalls,
      applyDirectTranscript,
      interruptPlayback,
      persistCompletedTurn,
      queueAudioChunk,
      setError,
      incrementPlaybackRevision: () => {
        setSession((currentSession) => currentSession ? {
          ...currentSession,
          playbackRevision: (currentSession.playbackRevision ?? 0) + 1,
        } : currentSession);
      },
      onTurnComplete: () => {
        isDirectTurnActiveRef.current = false;
        flushDirectAnnouncementQueue();
      },
    });
  }, [applyDirectTranscript, flushDirectAnnouncementQueue, interruptPlayback, persistCompletedTurn, prepareToolCalls, queueAudioChunk]);

  useEffect(() => {
    setSession((currentSession) => mergeSessionState(initialSession, currentSession));
    sessionIdRef.current = initialSession?.id ?? sessionIdRef.current;
  }, [initialSession]);

  useEffect(() => {
    sessionIdRef.current = session?.id ?? null;
  }, [session?.id]);

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
    if (!session?.id || transportModeRef.current === 'direct') {
      return;
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
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
    }, 200);
  }, [session?.id]);

  useLiveEvents({
    enabled: eventsEnabled,
    onSessionUpdate: (data) => {
      if (data.sessionId === session?.id) {
        refreshSession();
      }
    },
    onLiveTaskUpdate: (data) => {
      if (data.sessionId !== session?.id) {
        return;
      }

      if (transportModeRef.current === 'direct' && directSessionRef.current && data.status !== 'running') {
        enqueueDirectAnnouncement(buildLiveTaskAnnouncementPrompt(data.title, data.status, data.summary));
      }

      if (transportModeRef.current === 'relay') {
        refreshSession();
      }
    },
  });

  const sessionId = session?.id;
  const sessionStatus = session?.status;
  const sessionPlaybackRevision = session?.playbackRevision;

  useEffect(() => {
    if (!sessionId || sessionStatus !== 'live' || transportModeRef.current === 'direct') {
      lastAudioChunkIdRef.current = 0;
      lastPlaybackRevisionRef.current = 0;
      stopPollingRef.current = false;
      interruptPlayback();
      return;
    }

    const nextPlaybackRevision = sessionPlaybackRevision ?? 0;
    if (nextPlaybackRevision !== lastPlaybackRevisionRef.current) {
      lastPlaybackRevisionRef.current = nextPlaybackRevision;
      lastAudioChunkIdRef.current = 0;
      interruptPlayback();
    }

    const audioInterval = window.setInterval(() => {
      if (stopPollingRef.current || isAudioPollingRef.current) {
        return;
      }

      isAudioPollingRef.current = true;

      void liveSessionService
        .getAudioChunks(sessionId, lastAudioChunkIdRef.current)
        .then((chunks) => {
          isAudioPollingRef.current = false;

          if (chunks.length === 0) {
            return;
          }

          lastAudioChunkIdRef.current = chunks[chunks.length - 1].id;
          for (const chunk of chunks) {
            queueAudioChunk(chunk);
          }
        })
        .catch((pollError: unknown) => {
          isAudioPollingRef.current = false;
          if (pollError instanceof ApiError && pollError.status === 404) {
            stopPollingRef.current = true;
            setError('Live audio route is unavailable. Restart `npm run dev:server` and start a new session.');
          }
        });
    }, AUDIO_POLL_MS);

    return () => {
      window.clearInterval(audioInterval);
    };
  }, [interruptPlayback, queueAudioChunk, sessionId, sessionStatus, sessionPlaybackRevision]);

  useEffect(() => {
    return () => {
      const audioContext = audioContextRef.current;
      audioContextRef.current = null;
      stopAudioSource(currentSourceRef.current);
      currentSourceRef.current = null;
      if (audioContext) {
        void audioContext.close();
      }
      directSessionRef.current?.close();
      directSessionRef.current = null;
      directAnnouncementQueueRef.current = [];
      isDirectTurnActiveRef.current = false;
    };
  }, []);

  const startSession = async (): Promise<LiveSession | null> => {
    setIsBusy(true);
    setError(null);

    try {
      await ensureAudioContext();

      if (CAN_USE_DIRECT_LIVE) {
        const direct = await liveSessionService.startDirect();
        const ai = new GoogleGenAI({ apiKey: DIRECT_CLIENT_API_KEY });
        const liveSession = await ai.live.connect({
          model: direct.bootstrap.model,
          config: direct.bootstrap.config as any,
          callbacks: {
            onmessage: (message) => {
              void handleDirectMessage(message as Record<string, any>);
            },
            onerror: (event) => {
              setError(event?.error instanceof Error ? event.error.message : 'Gemini Live connection error.');
            },
            onclose: () => {
              interruptPlayback();
            },
          },
        });

        directSessionRef.current = liveSession;
        transportModeRef.current = 'direct';
        directAssistantTextRef.current = '';
        directUserTextRef.current = '';
        directAudioChunkIdRef.current = 0;
        directAnnouncementQueueRef.current = [];
        isDirectTurnActiveRef.current = false;
        setSession(direct.session);
        stopPollingRef.current = true;
        lastAudioChunkIdRef.current = 0;
        lastPlaybackRevisionRef.current = direct.session.playbackRevision ?? 0;
        audioQueueRef.current = [];
        setIsAssistantSpeaking(false);
        await onSessionChange?.();
        return direct.session;
      }

      const next = await liveSessionService.start();
      transportModeRef.current = 'relay';
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
      if (transportModeRef.current === 'direct') {
        directSessionRef.current?.close();
        directSessionRef.current = null;
        directAnnouncementQueueRef.current = [];
        isDirectTurnActiveRef.current = false;
      }
      const next = await liveSessionService.end(session.id);
      setSession(next);
      transportModeRef.current = null;
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
      if (transportModeRef.current === 'direct' && directSessionRef.current) {
        directUserTextRef.current = text.trim();
        applyDirectTranscript('user', directUserTextRef.current, 'complete');
        sendDirectPrompt(text);
        return;
      }

      const next = await liveSessionService.sendMessage(targetSessionId, text);
      setSession(next);
    } catch (messageError) {
      setError(getErrorMessage(messageError, 'Unable to send message'));
    } finally {
      setIsBusy(false);
    }
  };

  const sendAudioChunk = useCallback(async (payload: { mimeType: string; data: string }) => {
    const targetSessionId = sessionIdRef.current;
    if (!targetSessionId) {
      return;
    }

    if (transportModeRef.current === 'direct' && directSessionRef.current) {
      directSessionRef.current.sendRealtimeInput({ audio: payload });
      return;
    }

    await liveSessionService.sendAudio(targetSessionId, payload);
  }, []);

  const endAudioInput = useCallback(async () => {
    const targetSessionId = sessionIdRef.current;
    if (!targetSessionId) {
      return;
    }

    if (transportModeRef.current === 'direct' && directSessionRef.current) {
      directSessionRef.current.sendRealtimeInput({ audioStreamEnd: true });
      return;
    }

    await liveSessionService.endAudio(targetSessionId);
  }, []);

  const sendVideoFrame = useCallback(async (payload: { mimeType: string; data: string }) => {
    const targetSessionId = sessionIdRef.current;
    if (!targetSessionId) {
      return;
    }

    if (transportModeRef.current === 'direct' && directSessionRef.current) {
      directSessionRef.current.sendRealtimeInput({ video: payload });
      return;
    }

    await liveSessionService.sendFrame(targetSessionId, payload);
  }, []);

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
    sendAudioChunk,
    endAudioInput,
    sendVideoFrame,
  };
}
