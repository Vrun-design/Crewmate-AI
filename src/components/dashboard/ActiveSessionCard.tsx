import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, MonitorUp, ScreenShare, ScreenShareOff } from 'lucide-react';
import { motion } from 'motion/react';
import type { LiveSession } from '../../types/live';
import type { MicrophoneStatus, ScreenShareStatus } from '../../types/live';
import { getSessionProviderLabel, getSessionStatusLabel } from './dashboardUtils';

interface ActiveSessionCardProps {
  session: LiveSession | null;
  isSessionActive: boolean;
  elapsedLabel: string;
  isOverlayOpen: boolean;
  microphoneStatus: MicrophoneStatus;
  previewStream: MediaStream | null;
  screenShareStatus: ScreenShareStatus;
  onOpenOverlay: () => void;
}

export function ActiveSessionCard({
  session,
  isSessionActive,
  elapsedLabel,
  isOverlayOpen,
  microphoneStatus,
  previewStream,
  screenShareStatus,
  onOpenOverlay,
}: ActiveSessionCardProps): React.ReactNode {
  const isMicrophoneLive = microphoneStatus === 'recording';
  const isScreenSharing = screenShareStatus === 'sharing';
  const previewRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = previewRef.current;
    if (!video) {
      return;
    }

    if (!previewStream) {
      video.srcObject = null;
      return;
    }

    video.srcObject = previewStream;
    void video.play().catch(() => {});

    return () => {
      if (video.srcObject === previewStream) {
        video.srcObject = null;
      }
    };
  }, [previewStream]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-soft overflow-hidden relative group flex flex-col">
      <div className="w-full h-[320px] lg:h-[400px] bg-secondary relative flex items-center justify-center border-b border-border/50 overflow-hidden">
        {isSessionActive ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {previewStream ? (
              <video
                ref={previewRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover opacity-80"
              />
            ) : (
              <div className="w-full h-full opacity-30 bg-[url('https://images.unsplash.com/photo-1618401471353-b98a52333646?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center"></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-secondary via-transparent to-transparent"></div>

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="z-10 flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-full bg-background/50 border border-border flex items-center justify-center mb-4 backdrop-blur-md shadow-lg">
                <MonitorUp size={24} className="text-blue-500" />
              </div>
              <div className="text-lg font-medium tracking-tight text-foreground">Live Session Active</div>
              <div className="text-sm text-muted-foreground font-mono mt-2">{elapsedLabel}</div>
            </motion.div>

            <div className="absolute top-4 left-4 flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-sm"></div>
              <span className="text-xs font-medium text-red-500 uppercase tracking-wider">Live</span>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-background/5 border border-background/10 flex items-center justify-center mx-auto mb-4">
              <MonitorUp size={24} className="text-muted-foreground" />
            </div>
            <div className="text-muted-foreground font-medium tracking-tight">No active session</div>
            <div className="text-sm text-muted-foreground/60 mt-1">Click Start Live Session to open the live overlay</div>
          </div>
        )}
      </div>

      <div className="p-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isSessionActive
                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                : 'bg-secondary text-muted-foreground border border-border'
              }`}
          >
            <Mic size={18} />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">
              {getSessionStatusLabel(isSessionActive, session?.provider)}
            </div>
            <div className="text-xs text-muted-foreground">{getSessionProviderLabel(session?.provider)}</div>
          </div>
        </div>

        {isSessionActive && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1">
                {isScreenSharing ? <ScreenShare size={12} className="text-foreground" /> : <ScreenShareOff size={12} />}
                {isScreenSharing ? 'Screen shared' : 'Screen off'}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1">
                {isMicrophoneLive ? <Mic size={12} className="text-foreground" /> : <MicOff size={12} />}
                {isMicrophoneLive ? 'Mic live' : 'Mic muted'}
              </span>
            </div>

            {!isOverlayOpen ? (
              <button
                type="button"
                onClick={onOpenOverlay}
                className="rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                Open Controls
              </button>
            ) : (
              <div className="flex items-center gap-1 h-6 px-2" aria-label="audio-activity">
                <div className="audio-bar"></div>
                <div className="audio-bar"></div>
                <div className="audio-bar"></div>
                <div className="audio-bar"></div>
                <div className="audio-bar"></div>
                <div className="audio-bar"></div>
                <div className="audio-bar"></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
