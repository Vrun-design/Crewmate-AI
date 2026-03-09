import {useCallback, useEffect, useRef, useState} from 'react';
import {liveSessionService} from '../services/liveSessionService';
import {arrayBufferToBase64} from '../utils/mediaEncoding';
import type {ScreenShareStatus} from '../types/live';

const CAPTURE_INTERVAL_MS = 4000;
const VIDEO_READY_TIMEOUT_MS = 1500;

interface UseScreenShareCaptureOptions {
  sessionId: string | null;
  enabled: boolean;
}

interface UseScreenShareCaptureResult {
  status: ScreenShareStatus;
  error: string | null;
  isSupported: boolean;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
}

export function useScreenShareCapture({
  sessionId,
  enabled,
}: UseScreenShareCaptureOptions): UseScreenShareCaptureResult {
  const [status, setStatus] = useState<ScreenShareStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const uploadInFlightRef = useRef(false);
  const attemptedSessionIdRef = useRef<string | null>(null);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === 'function';

  const waitForVideoReady = useCallback((video: HTMLVideoElement) => {
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('Screen share started but no video frame became available.'));
      }, VIDEO_READY_TIMEOUT_MS);

      function cleanup() {
        window.clearTimeout(timeout);
        video.removeEventListener('loadedmetadata', handleReady);
        video.removeEventListener('canplay', handleReady);
      }

      function handleReady() {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          cleanup();
          resolve();
        }
      }

      video.addEventListener('loadedmetadata', handleReady);
      video.addEventListener('canplay', handleReady);
    });
  }, []);

  const stopScreenShare = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    videoRef.current = null;
    canvasRef.current = null;
    uploadInFlightRef.current = false;
    setStatus('idle');
  }, []);

  const captureAndSendFrame = useCallback(async () => {
    if (!sessionId || !videoRef.current || !canvasRef.current || uploadInFlightRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      return;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    uploadInFlightRef.current = true;

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.72);
      });

      if (!blob) {
        throw new Error('Unable to capture screen frame.');
      }

      const buffer = await blob.arrayBuffer();
      await liveSessionService.sendFrame(sessionId, {
        mimeType: blob.type || 'image/jpeg',
        data: arrayBufferToBase64(buffer),
      });
      setStatus('sharing');
      setError(null);
    } catch (captureError) {
      setStatus('error');
      setError(captureError instanceof Error ? captureError.message : 'Unable to send screen frame.');
    } finally {
      uploadInFlightRef.current = false;
    }
  }, [sessionId]);

  const startScreenShare = useCallback(async () => {
    if (!enabled || !sessionId || streamRef.current || !isSupported) {
      return;
    }

    setStatus('requesting');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 1,
          width: {ideal: 1440},
        },
        audio: false,
      });

      streamRef.current = stream;

      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      await waitForVideoReady(video);

      videoRef.current = video;
      canvasRef.current = document.createElement('canvas');

      await captureAndSendFrame();
      intervalRef.current = window.setInterval(() => {
        void captureAndSendFrame();
      }, CAPTURE_INTERVAL_MS);
      setStatus('sharing');
    } catch (shareError) {
      setStatus('error');
      setError(shareError instanceof Error ? shareError.message : 'Screen share permission was denied.');
    }
  }, [captureAndSendFrame, enabled, isSupported, sessionId, stopScreenShare, waitForVideoReady]);

  useEffect(() => {
    if (!enabled || !sessionId) {
      attemptedSessionIdRef.current = null;
      stopScreenShare();
      return;
    }

    if (attemptedSessionIdRef.current === sessionId || streamRef.current || !isSupported) {
      return;
    }

    attemptedSessionIdRef.current = sessionId;
    void startScreenShare();
  }, [enabled, isSupported, sessionId, startScreenShare, stopScreenShare]);

  useEffect(() => () => stopScreenShare(), [stopScreenShare]);

  return {
    status,
    error,
    isSupported,
    startScreenShare,
    stopScreenShare,
  };
}
