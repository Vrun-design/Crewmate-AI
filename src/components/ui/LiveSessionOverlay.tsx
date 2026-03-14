import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, ScreenShare, ScreenShareOff, Square, Minimize2, AlignLeft, User, BrainCircuit } from 'lucide-react';
import { Drawer } from './Drawer';
import { LiveTaskCueBadge } from './LiveTaskCueBadge';
import type { MicrophoneStatus, ScreenShareStatus, TranscriptMessage } from '../../types/live';
import type { LiveTaskCue } from '../../types/liveTaskCue';
import { getDisplayNameFromEmail } from '../../utils/userName';

interface LiveSessionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  transcript?: TranscriptMessage[];
  onSendMessage?: (text: string) => Promise<void> | void;
  isBusy?: boolean;
  provider?: 'local' | 'gemini-live';
  previewStream?: MediaStream | null;
  onEndSession?: () => void;
  screenShareStatus?: ScreenShareStatus;
  isScreenShareSupported?: boolean;
  onStartScreenShare?: () => Promise<void> | void;
  onStopScreenShare?: () => void;
  microphoneStatus?: MicrophoneStatus;
  isMicrophoneSupported?: boolean;
  onToggleMicrophone?: () => Promise<void> | void;
  liveTaskCue?: LiveTaskCue | null;
}

function getComposerPlaceholder(provider: 'local' | 'gemini-live'): string {
  if (provider === 'gemini-live') {
    return "Try: 'Crewmate, I see an alignment bug here on screen. File a ticket on ClickUp.'";
  }

  return 'Local mode active';
}

function getScreenShareLabel(status: ScreenShareStatus): string {
  if (status === 'sharing') {
    return 'Screen shared';
  }

  if (status === 'requesting') {
    return 'Requesting screen share...';
  }

  if (status === 'error') {
    return 'Screen share failed';
  }

  return 'Share your screen';
}

function getMicrophoneLabel(status: MicrophoneStatus): string {
  if (status === 'recording') {
    return 'Mic live';
  }

  if (status === 'requesting') {
    return 'Requesting mic...';
  }

  if (status === 'error') {
    return 'Mic failed';
  }

  if (status === 'muted') {
    return 'Mic muted';
  }

  return 'Mic ready';
}

const AUDIO_BARS = [
  { id: 1, base: 12, active: [12, 32, 12], delay: 0 },
  { id: 2, base: 16, active: [16, 48, 16], delay: 0.1 },
  { id: 3, base: 24, active: [24, 64, 24], delay: 0.2 },
  { id: 4, base: 16, active: [16, 52, 16], delay: 0.3 },
  { id: 5, base: 12, active: [12, 36, 12], delay: 0.4 },
];

export function LiveSessionOverlay({
  isOpen,
  onClose,
  transcript = [],
  onSendMessage,
  isBusy = false,
  provider = 'local',
  previewStream = null,
  onEndSession,
  screenShareStatus = 'idle',
  isScreenShareSupported = false,
  onStartScreenShare,
  onStopScreenShare,
  microphoneStatus = 'idle',
  isMicrophoneSupported = false,
  onToggleMicrophone,
  liveTaskCue,
}: LiveSessionOverlayProps) {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState('User');
  const [draft, setDraft] = useState('');
  const previewRef = useRef<HTMLVideoElement | null>(null);

  const setVideoRef = useCallback((video: HTMLVideoElement | null) => {
    previewRef.current = video;
    if (video && previewStream) {
      video.srcObject = previewStream;
      void video.play().catch(() => {});
    }
  }, [previewStream]);

  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;

    if (!previewStream) {
      video.srcObject = null;
      return;
    }

    if (video.srcObject !== previewStream) {
      video.srcObject = previewStream;
      void video.play().catch(() => {});
    }

    return () => {
      if (video && video.srcObject === previewStream) {
        video.srcObject = null;
      }
    };
  }, [previewStream]);

  useEffect(() => {
    setMounted(true);
    setUsername(getDisplayNameFromEmail(localStorage.getItem('crewmate_user_email')));
  }, []);

  if (!mounted) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draft.trim();
    if (!next || !onSendMessage) {
      return;
    }

    await onSendMessage(next);
    setDraft('');
  };

  const composerPlaceholder = getComposerPlaceholder(provider);
  const isMuted = microphoneStatus === 'muted' || microphoneStatus === 'idle';
  const isScreenSharing = screenShareStatus === 'sharing';
  const lastAgentMessage = [...transcript].reverse().find((m) => m.role === 'agent')?.text ?? null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center p-4 md:p-6"
        >
          {/* Top Bar (Header) */}
          <div className="w-full flex justify-end shrink-0 max-w-7xl mx-auto mb-2">
            <button
              onClick={() => setIsTranscriptOpen(true)}
              className="p-2.5 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative shadow-sm"
              title="Open Transcript"
            >
              <AlignLeft size={20} />
              {!isMuted && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-primary border-2 border-background rounded-full"></span>
              )}
            </button>
          </div>

          {/* Main View Area (Flex-1) */}
          <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col items-center justify-center min-h-0 relative mb-6">
            {previewStream ? (
              <div className="w-full h-full max-h-full rounded-2xl bg-black border border-border/50 shadow-2xl overflow-hidden flex items-center justify-center relative">
                <video
                  ref={setVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-md bg-black/50 backdrop-blur-md border border-white/10">
                  <ScreenShare size={14} className="text-white" />
                  <span className="text-xs font-medium text-white uppercase tracking-wider">Sharing Screen</span>
                </div>
              </div>
            ) : (
              <div className="relative flex flex-col items-center justify-center w-full h-full gap-6">
                {/* Outer Glow */}
                {!isMuted && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-80 h-80 rounded-full bg-primary/20 blur-3xl pointer-events-none"
                  />
                )}
                <div className="relative w-56 h-56 rounded-full bg-secondary border border-border shadow-2xl flex items-center justify-center overflow-hidden">
                  <div className="flex items-center justify-center gap-2 h-24">
                    {AUDIO_BARS.map((bar) => (
                      <motion.div
                        key={bar.id}
                        className={`w-2 rounded-full ${isMuted ? 'bg-muted-foreground/50' : 'bg-foreground'}`}
                        animate={{ height: isMuted ? bar.base : bar.active }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: bar.delay, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                </div>

                {/* Last agent message */}
                <AnimatePresence mode="wait">
                  {lastAgentMessage && (
                    <motion.p
                      key={lastAgentMessage.slice(0, 40)}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3 }}
                      className="relative z-10 max-w-md text-center text-sm text-muted-foreground px-4"
                    >
                      {lastAgentMessage.length > 160 ? `${lastAgentMessage.slice(0, 160)}…` : lastAgentMessage}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Task Cue Banner */}
          <AnimatePresence>
            {liveTaskCue && (
              <motion.div
                key={liveTaskCue.status + liveTaskCue.title.slice(0, 20)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
              >
                <LiveTaskCueBadge cue={liveTaskCue} className="shrink-0 mb-3 max-w-full" titleMaxLength={60} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Dock (Controls & Input) */}
          <div className="shrink-0 w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4">
            {/* Action Toggles */}
            <div className="flex items-center gap-3 p-2 rounded-2xl bg-secondary/80 backdrop-blur-xl border border-border shadow-lg">
              <button
                onClick={() => void onToggleMicrophone?.()}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-background shadow-sm text-foreground'}`}
                title={getMicrophoneLabel(microphoneStatus)}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              
              {isScreenShareSupported && (
                <button
                  onClick={isScreenSharing ? onStopScreenShare : () => void onStartScreenShare?.()}
                  className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20' : 'bg-background shadow-sm text-foreground hover:bg-accent'}`}
                  title={isScreenSharing ? 'Stop Sharing' : getScreenShareLabel(screenShareStatus)}
                >
                  {isScreenSharing ? <ScreenShareOff size={20} /> : <ScreenShare size={20} />}
                </button>
              )}

              {onEndSession && (
                <button
                  onClick={onEndSession}
                  className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                  title="End Session"
                >
                  <Square size={18} className="fill-current" />
                </button>
              )}

              <div className="w-px h-8 bg-border mx-1"></div>

              <button
                onClick={onClose}
                className="w-12 h-12 rounded-xl bg-background shadow-sm text-muted-foreground flex items-center justify-center hover:text-foreground hover:bg-accent transition-colors"
                title="Minimize Overlay"
              >
                <Minimize2 size={20} />
              </button>
            </div>

            {/* Input Box */}
            <form onSubmit={handleSubmit} className="flex-1 w-full bg-secondary/80 backdrop-blur-xl rounded-2xl p-2 border border-border shadow-lg flex items-center gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={composerPlaceholder}
                className="flex-1 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || !onSendMessage || isBusy}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors truncate"
              >
                {isBusy ? '...' : 'Send'}
              </button>
            </form>
          </div>

          {/* Transcript Drawer Container */}
          <Drawer
            isOpen={isTranscriptOpen}
            onClose={() => setIsTranscriptOpen(false)}
            title="Live Transcript"
          >
            <div className="space-y-6 p-2">
              {transcript.length > 0 ? (
                transcript.map((message) => (
                  <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${message.role === 'agent'
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-secondary border border-border'
                        }`}
                    >
                      {message.role === 'agent' ? (
                        <BrainCircuit size={16} />
                      ) : (
                        <User size={16} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className={message.role === 'user' ? 'text-right' : ''}>
                      <div className="text-sm font-medium text-foreground">
                        {message.role === 'agent' ? 'Crewmate' : username}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">{message.text}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                    <BrainCircuit size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">Crewmate</div>
                    <div className="text-sm text-muted-foreground mt-1">No transcript yet. Start a live session from the dashboard to populate this stream.</div>
                  </div>
                </div>
              )}

              {!isMuted && (
                <div className="flex gap-3 flex-row-reverse">
                  <div className="text-right">
                    <div className="text-sm font-medium text-foreground">You</div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center justify-end gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                    <User size={16} className="text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          </Drawer>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
