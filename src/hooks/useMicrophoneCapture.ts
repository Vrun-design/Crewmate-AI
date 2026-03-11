import { useCallback, useEffect, useRef, useState } from 'react';
import { liveSessionConfig } from '../config/liveSessionConfig';
import { liveSessionService } from '../services/liveSessionService';
import { arrayBufferToBase64 } from '../utils/mediaEncoding';
import type { MicrophoneStatus } from '../types/live';

const PCM_SAMPLE_RATE = 16000;
const PCM_FLUSH_MS = 250;

interface UseMicrophoneCaptureOptions {
  sessionId: string | null;
  enabled: boolean;
  isAssistantSpeaking?: boolean;
}

interface UseMicrophoneCaptureResult {
  status: MicrophoneStatus;
  error: string | null;
  isSupported: boolean;
  startMicrophone: () => Promise<void>;
  stopMicrophone: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
}

function downsampleBuffer(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (targetRate >= sourceRate) {
    return input;
  }

  const ratio = sourceRate / targetRate;
  const length = Math.round(input.length / ratio);
  const output = new Float32Array(length);
  let offset = 0;

  for (let index = 0; index < length; index += 1) {
    const nextOffset = Math.round((index + 1) * ratio);
    let sum = 0;
    let count = 0;

    for (let sampleIndex = offset; sampleIndex < nextOffset && sampleIndex < input.length; sampleIndex += 1) {
      sum += input[sampleIndex];
      count += 1;
    }

    output[index] = count > 0 ? sum / count : 0;
    offset = nextOffset;
  }

  return output;
}

function floatTo16BitPcm(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}

function getAudioLevel(input: Float32Array): number {
  if (input.length === 0) {
    return 0;
  }

  let total = 0;
  for (const sample of input) {
    total += Math.abs(sample);
  }

  return total / input.length;
}

export function useMicrophoneCapture({
  sessionId,
  enabled,
  isAssistantSpeaking = false,
}: UseMicrophoneCaptureOptions): UseMicrophoneCaptureResult {
  const [status, setStatus] = useState<MicrophoneStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const pcmChunksRef = useRef<Int16Array[]>([]);
  const flushTimerRef = useRef<number | null>(null);
  const isAssistantSpeakingRef = useRef(isAssistantSpeaking);
  const speechStartedAtRef = useRef<number | null>(null);
  const lastSpeechDetectedAtRef = useRef<number | null>(null);
  const turnClosedRef = useRef(false);
  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.AudioContext !== 'undefined' &&
    typeof window.AudioWorklet !== 'undefined';

  const resetTurnDetection = useCallback(() => {
    speechStartedAtRef.current = null;
    lastSpeechDetectedAtRef.current = null;
    turnClosedRef.current = false;
    pcmChunksRef.current = [];
  }, []);

  const flushAudio = useCallback(async (currentSessionId: string) => {
    const chunks = pcmChunksRef.current;
    if (chunks.length === 0) {
      return;
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    pcmChunksRef.current = [];

    await liveSessionService.sendAudio(currentSessionId, {
      mimeType: `audio/pcm;rate=${PCM_SAMPLE_RATE}`,
      data: arrayBufferToBase64(merged.buffer),
    });
  }, []);

  const maybeCloseTurn = useCallback(async (currentSessionId: string) => {
    const speechStartedAt = speechStartedAtRef.current;
    const lastSpeechDetectedAt = lastSpeechDetectedAtRef.current;

    if (
      !liveSessionConfig.conservativeTurnTaking ||
      !speechStartedAt ||
      !lastSpeechDetectedAt ||
      turnClosedRef.current
    ) {
      return;
    }

    const now = Date.now();
    if (now - speechStartedAt < liveSessionConfig.minSpeechWindowMs) {
      return;
    }

    if (now - lastSpeechDetectedAt < liveSessionConfig.silenceWindowMs) {
      return;
    }

    await flushAudio(currentSessionId);
    await liveSessionService.endAudio(currentSessionId);
    turnClosedRef.current = true;
    speechStartedAtRef.current = null;
    lastSpeechDetectedAtRef.current = null;
  }, [flushAudio]);

  const stopMicrophone = useCallback(async () => {
    const currentSessionId = sessionId;

    if (flushTimerRef.current) {
      window.clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (currentSessionId) {
      try {
        await flushAudio(currentSessionId);
      } catch {
        // Keep teardown resilient.
      }
    }

    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext) {
      await audioContext.close();
    }

    resetTurnDetection();

    if (currentSessionId) {
      try {
        await liveSessionService.endAudio(currentSessionId);
      } catch {
        // Keep the UI responsive even if the local backend is unavailable.
      }
    }

    setStatus('muted');
  }, [flushAudio, resetTurnDetection, sessionId]);

  const startMicrophone = useCallback(async () => {
    if (!enabled || !sessionId || streamRef.current || !isSupported) {
      return;
    }

    setStatus('requesting');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      const audioContext = new window.AudioContext();
      audioContextRef.current = audioContext;
      streamRef.current = stream;

      // Load the AudioWorklet module (served from /public)
      await audioContext.audioWorklet.addModule('/pcm-processor.js');

      const source = audioContext.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-capture-processor');
      workletNodeRef.current = workletNode;

      // Receive raw Float32 chunks from the worklet thread
      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        if (isAssistantSpeakingRef.current) {
          return;
        }

        const rawChunk = event.data;
        const audioLevel = getAudioLevel(rawChunk);
        const now = Date.now();
        const isSpeech = audioLevel >= liveSessionConfig.speechLevelThreshold;

        if (isSpeech) {
          if (!speechStartedAtRef.current) {
            speechStartedAtRef.current = now;
          }

          lastSpeechDetectedAtRef.current = now;
          turnClosedRef.current = false;
        }

        if (!isSpeech && !speechStartedAtRef.current) {
          return;
        }

        const downsampled = downsampleBuffer(rawChunk, audioContext.sampleRate, PCM_SAMPLE_RATE);
        pcmChunksRef.current.push(floatTo16BitPcm(downsampled));
      };

      source.connect(workletNode);
      // Worklet must be connected to destination to keep the audio graph alive
      workletNode.connect(audioContext.destination);

      flushTimerRef.current = window.setInterval(() => {
        if (isAssistantSpeakingRef.current) {
          return;
        }

        void flushAudio(sessionId)
          .then(() => maybeCloseTurn(sessionId))
          .catch((captureError: unknown) => {
          setStatus('error');
          setError(captureError instanceof Error ? captureError.message : 'Unable to stream microphone audio.');
          });
      }, PCM_FLUSH_MS);

      setStatus('recording');
    } catch (microphoneError) {
      setStatus('error');
      setError(microphoneError instanceof Error ? microphoneError.message : 'Microphone permission was denied.');
    }
  }, [enabled, flushAudio, isSupported, maybeCloseTurn, sessionId]);

  const toggleMicrophone = useCallback(async () => {
    if (status === 'recording') {
      await stopMicrophone();
      return;
    }

    await startMicrophone();
  }, [startMicrophone, status, stopMicrophone]);

  useEffect(() => {
    isAssistantSpeakingRef.current = isAssistantSpeaking;
    if (isAssistantSpeaking) {
      resetTurnDetection();
    }
  }, [isAssistantSpeaking, resetTurnDetection]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      if (status === 'recording' || status === 'requesting') {
        void stopMicrophone();
      } else {
        setStatus('idle');
      }
    }
  }, [enabled, isSupported, sessionId, startMicrophone, status, stopMicrophone]);

  useEffect(() => {
    return () => {
      void stopMicrophone();
    };
  }, [stopMicrophone]);

  return {
    status,
    error,
    isSupported,
    startMicrophone,
    stopMicrophone,
    toggleMicrophone,
  };
}
