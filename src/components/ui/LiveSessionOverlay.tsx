import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Monitor, ScreenShare, ScreenShareOff, X, AlignLeft, BrainCircuit, User } from 'lucide-react';
import { Drawer } from './Drawer';
import type { MicrophoneStatus, ScreenShareStatus, TranscriptMessage } from '../../types/live';
import { getDisplayNameFromEmail } from '../../utils/userName';

interface LiveSessionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  transcript?: TranscriptMessage[];
  onSendMessage?: (text: string) => Promise<void> | void;
  isBusy?: boolean;
  provider?: 'local' | 'gemini-live';
  screenShareStatus?: ScreenShareStatus;
  screenShareError?: string | null;
  isScreenShareSupported?: boolean;
  onStartScreenShare?: () => Promise<void> | void;
  onStopScreenShare?: () => void;
  microphoneStatus?: MicrophoneStatus;
  microphoneError?: string | null;
  isMicrophoneSupported?: boolean;
  onToggleMicrophone?: () => Promise<void> | void;
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

export function LiveSessionOverlay({
  isOpen,
  onClose,
  transcript = [],
  onSendMessage,
  isBusy = false,
  provider = 'local',
  screenShareStatus = 'idle',
  screenShareError = null,
  isScreenShareSupported = false,
  onStartScreenShare,
  onStopScreenShare,
  microphoneStatus = 'idle',
  microphoneError = null,
  isMicrophoneSupported = false,
  onToggleMicrophone,
}: LiveSessionOverlayProps) {
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState('User');
  const [draft, setDraft] = useState('');

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
  const screenShareLabel = getScreenShareLabel(screenShareStatus);
  const microphoneLabel = getMicrophoneLabel(microphoneStatus);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md flex flex-col items-center justify-between p-6 md:p-8"
        >
          {/* Top Bar */}
          <div className="w-full flex justify-end max-w-6xl mx-auto">
            <button
              onClick={() => setIsTranscriptOpen(true)}
              className="p-2.5 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative"
            >
              <AlignLeft size={20} />
              {!isMuted && (
                <span className="absolute top-0 right-0 w-3 h-3 bg-blue-500 border-2 border-background rounded-full"></span>
              )}
            </button>
          </div>

          {/* Center Orb */}
          <div className="flex-1 flex items-center justify-center relative w-full max-w-md">
            {/* Outer Glow */}
            {!isMuted && (
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute w-64 h-64 rounded-full bg-blue-500/30 blur-3xl pointer-events-none"
              />
            )}

            {/* Inner Orb */}
            <div className="relative w-48 h-48 rounded-full bg-secondary border border-border shadow-2xl flex items-center justify-center overflow-hidden">
              {/* Audio Wave */}
              <div className="flex items-center justify-center gap-1.5 h-24">
                {[
                  { id: 1, base: 12, active: [12, 24, 12], delay: 0 },
                  { id: 2, base: 16, active: [16, 36, 16], delay: 0.1 },
                  { id: 3, base: 24, active: [24, 48, 24], delay: 0.2 },
                  { id: 4, base: 16, active: [16, 40, 16], delay: 0.3 },
                  { id: 5, base: 12, active: [12, 28, 12], delay: 0.4 },
                ].map((bar) => (
                  <motion.div
                    key={bar.id}
                    className={`w-1.5 rounded-full ${isMuted ? 'bg-muted-foreground/50' : 'bg-foreground'}`}
                    animate={{ height: isMuted ? bar.base : bar.active }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: bar.delay,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="w-full max-w-xl flex flex-col gap-4 mb-4 md:mb-8 px-4">
            <div className="grid gap-2 text-xs text-muted-foreground px-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Monitor size={14} />
                  <span>{screenShareLabel}</span>
                  {screenShareError ? <span className="text-red-500">{screenShareError}</span> : null}
                </div>

                {isScreenShareSupported ? (
                  isScreenSharing ? (
                    <button
                      type="button"
                      onClick={onStopScreenShare}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-foreground transition-colors hover:bg-accent"
                    >
                      <ScreenShareOff size={14} />
                      Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onStartScreenShare?.()}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-foreground transition-colors hover:bg-accent"
                    >
                      <ScreenShare size={14} />
                      Share Screen
                    </button>
                  )
                ) : (
                  <span>Screen capture unsupported in this browser.</span>
                )}
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                  <span>{microphoneLabel}</span>
                  {microphoneError ? <span className="text-red-500">{microphoneError}</span> : null}
                </div>

                {isMicrophoneSupported ? (
                  <button
                    type="button"
                    onClick={() => void onToggleMicrophone?.()}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-foreground transition-colors hover:bg-accent"
                  >
                    {isMuted ? <Mic size={14} /> : <MicOff size={14} />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                ) : (
                  <span>Microphone capture unsupported in this browser.</span>
                )}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-3 border border-border">
              <div className="flex items-center gap-3">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={composerPlaceholder}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || !onSendMessage || isBusy}
                  className="px-3 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium disabled:opacity-50"
                >
                  {isBusy ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>

            <div className="w-full max-w-md self-center flex items-center justify-between">
              <div className="w-12"></div>

              <div className="flex items-center gap-4">
                <button
                  onClick={() => void onToggleMicrophone?.()}
                  className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all ${isMuted
                      ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                      : 'bg-secondary border-border text-foreground hover:bg-accent'
                    }`}
                >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                  onClick={onClose}
                  className="w-14 h-14 rounded-full bg-secondary border border-border text-foreground flex items-center justify-center hover:bg-accent transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="w-12 flex justify-end"></div>
            </div>
          </div>

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
                          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
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
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
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
    document.body
  );
}
