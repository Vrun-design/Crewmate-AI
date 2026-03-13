import React, { createContext, useContext, useState } from 'react';
import { useLiveSession } from '../hooks/useLiveSession';
import { useMicrophoneCapture } from '../hooks/useMicrophoneCapture';
import { useScreenShareCapture } from '../hooks/useScreenShareCapture';
import { useCurrentSession } from '../hooks/useCurrentSession';
import { usePreferences } from '../hooks/usePreferences';
import { useLiveEvents } from '../hooks/useLiveEvents';
import type { LiveSession, MicrophoneStatus, ScreenShareStatus } from '../types/live';
import { liveSessionService } from '../services/liveSessionService';

interface LiveSessionContextValue {
  session: LiveSession | null;
  isSessionActive: boolean;
  isBusy: boolean;
  error: string | null;
  elapsedLabel: string;
  isAssistantSpeaking: boolean;
  
  microphoneStatus: MicrophoneStatus;
  microphoneError: string | null;
  isMicrophoneSupported: boolean;
  
  screenShareStatus: ScreenShareStatus;
  screenShareError: string | null;
  isScreenShareSupported: boolean;
  previewStream: MediaStream | null;
  captureScreenshotArtifact: (options?: { title?: string; caption?: string }) => Promise<{ id: string; publicUrl: string } | null>;
  liveTaskCue: { title: string; status: 'completed' | 'failed'; summary?: string | null } | null;
  
  isOverlayOpen: boolean;
  setIsOverlayOpen: (open: boolean) => void;
  
  startSession: () => Promise<LiveSession | null>;
  endSession: () => Promise<void>;
  sendMessage: (text: string, sessionIdOverride?: string) => Promise<void>;
  
  startMicrophone: () => Promise<void>;
  stopMicrophone: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
}

const LiveSessionContext = createContext<LiveSessionContextValue | null>(null);

export function LiveSessionProvider({ children }: { children: React.ReactNode }) {
  const { session: currentSession, refresh } = useCurrentSession(true);
  const { preferences } = usePreferences(true);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [liveTaskCue, setLiveTaskCue] = useState<{ title: string; status: 'completed' | 'failed'; summary?: string | null } | null>(null);
  const captureCurrentFrameRef = React.useRef<(() => Promise<{ mimeType: string; data: string } | null>) | null>(null);

  const prepareToolCalls = React.useCallback(async (calls: Array<{ id?: string; name?: string; args?: Record<string, unknown> }>) => {
    const nextCalls = [...calls];
    for (let index = 0; index < nextCalls.length; index += 1) {
      const call = nextCalls[index];
      if (call.name !== 'live_capture-screenshot') {
        continue;
      }

      const title = typeof call.args?.title === 'string' ? call.args.title : undefined;
      const caption = typeof call.args?.caption === 'string' ? call.args.caption : undefined;
      const freshFrame = await captureCurrentFrameRef.current?.();
      if (freshFrame) {
        nextCalls[index] = {
          ...call,
          args: {
            ...(call.args ?? {}),
            ...freshFrame,
            ...(title ? { title } : {}),
            ...(caption ? { caption } : {}),
          },
        };
      }
    }

    return nextCalls;
  }, []);

  const {
    session,
    isBusy,
    error: liveSessionError,
    elapsedLabel,
    isSessionActive,
    isAssistantSpeaking,
    startSession,
    endSession,
    sendMessage,
    sendAudioChunk,
    endAudioInput,
    sendVideoFrame,
  } = useLiveSession({
    initialSession: currentSession,
    onSessionChange: refresh,
    eventsEnabled: true,
    prepareToolCalls,
  });

  const {
    status: screenShareStatus,
    error: screenShareError,
    isSupported: isScreenShareSupported,
    previewStream,
    captureCurrentFrame,
    startScreenShare,
    stopScreenShare,
  } = useScreenShareCapture({
    sessionId: session?.id ?? null,
    enabled: isSessionActive,
    onFrame: sendVideoFrame,
  });

  React.useEffect(() => {
    captureCurrentFrameRef.current = captureCurrentFrame;
  }, [captureCurrentFrame]);

  const {
    status: microphoneStatus,
    error: microphoneError,
    isSupported: isMicrophoneSupported,
    startMicrophone,
    toggleMicrophone,
    stopMicrophone,
  } = useMicrophoneCapture({
    sessionId: session?.id ?? null,
    enabled: isSessionActive,
    onAudioChunk: sendAudioChunk,
    onAudioStreamEnd: endAudioInput,
  });

  // Auto-start mic when session starts
  React.useEffect(() => {
    if (!isSessionActive || !isMicrophoneSupported || microphoneStatus !== 'idle') return;
    void startMicrophone();
  }, [isMicrophoneSupported, isSessionActive, microphoneStatus, startMicrophone]);

  // Auto-start screen share if preferences dictate
  React.useEffect(() => {
    if (!isSessionActive || !preferences?.autoStartScreenShare || screenShareStatus !== 'idle') return;
    void startScreenShare();
  }, [isSessionActive, preferences?.autoStartScreenShare, screenShareStatus, startScreenShare]);

  useLiveEvents({
    enabled: true,
    onLiveTaskUpdate: (event) => {
      if (!session?.id || event.sessionId !== session.id) {
        return;
      }

      setLiveTaskCue({
        title: event.title,
        status: event.status,
        summary: event.summary ?? null,
      });
    },
  });

  React.useEffect(() => {
    if (!liveTaskCue) {
      return;
    }

    const timer = window.setTimeout(() => {
      setLiveTaskCue(null);
    }, 7000);

    return () => window.clearTimeout(timer);
  }, [liveTaskCue]);

  const captureScreenshotArtifact = React.useCallback(async (options?: { title?: string; caption?: string }) => {
    if (!session?.id) {
      return null;
    }

    const freshFrame = await captureCurrentFrame();
    const artifact = await liveSessionService.captureScreenshot(session.id, {
      ...(freshFrame ?? {}),
      title: options?.title,
      caption: options?.caption,
    });

    return artifact ? { id: artifact.id, publicUrl: artifact.publicUrl } : null;
  }, [captureCurrentFrame, session?.id]);

  const value: LiveSessionContextValue = {
    session,
    isSessionActive,
    isBusy,
    error: liveSessionError,
    elapsedLabel,
    isAssistantSpeaking,
    
    microphoneStatus,
    microphoneError,
    isMicrophoneSupported,
    
    screenShareStatus,
    screenShareError,
    isScreenShareSupported,
    previewStream,
    captureScreenshotArtifact,
    liveTaskCue,
    
    isOverlayOpen,
    setIsOverlayOpen,
    
    startSession,
    endSession,
    sendMessage,
    
    startMicrophone,
    stopMicrophone,
    toggleMicrophone,
    
    startScreenShare,
    stopScreenShare,
  };

  return (
    <LiveSessionContext.Provider value={value}>
      {children}
    </LiveSessionContext.Provider>
  );
}

export function useLiveSessionContext(): LiveSessionContextValue {
  const context = useContext(LiveSessionContext);
  if (!context) {
    throw new Error('useLiveSessionContext must be used within a LiveSessionProvider');
  }
  return context;
}
