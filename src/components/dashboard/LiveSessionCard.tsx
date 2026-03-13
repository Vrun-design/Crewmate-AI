import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, ScreenShare, ScreenShareOff, Maximize2, Play, Square } from 'lucide-react';
import type { LiveSession, MicrophoneStatus, ScreenShareStatus } from '../../types/live';

interface LiveSessionCardProps {
  session: LiveSession | null;
  isSessionActive: boolean;
  microphoneStatus: MicrophoneStatus;
  screenShareStatus: ScreenShareStatus;
  isMicrophoneSupported: boolean;
  isScreenShareSupported: boolean;
  isBusy: boolean;
  provider: 'local' | 'gemini-live';
  previewStream: MediaStream | null;
  onOpenOverlay: () => void;
  onToggleSession: () => void;
  onToggleMicrophone: () => Promise<void> | void;
  onStartScreenShare: () => Promise<void> | void;
  onStopScreenShare: () => void;
  onSendMessage: (text: string) => Promise<void> | void;
}

function getComposerPlaceholder(provider: 'local' | 'gemini-live'): string {
  if (provider === 'gemini-live') {
    return "Try: 'Crewmate, I see an alignment bug here on screen. File a ticket on ClickUp.'";
  }
  return 'Local mode active';
}

function getScreenShareLabel(status: ScreenShareStatus): string {
  if (status === 'sharing') return 'Screen shared';
  if (status === 'requesting') return 'Requesting screen share...';
  if (status === 'error') return 'Screen share failed';
  return 'Share your screen';
}

function getMicrophoneLabel(status: MicrophoneStatus): string {
  if (status === 'recording') return 'Mic live';
  if (status === 'requesting') return 'Requesting mic...';
  if (status === 'error') return 'Mic failed';
  if (status === 'muted') return 'Mic muted';
  return 'Mic ready';
}

function getSessionToggleTitle(isSessionActive: boolean): string {
  return isSessionActive ? 'End Session' : 'Start Live Session';
}

const AUDIO_BARS = [
  { id: 1, base: 8, active: [8, 16, 8], delay: 0 },
  { id: 2, base: 12, active: [12, 24, 12], delay: 0.1 },
  { id: 3, base: 16, active: [16, 32, 16], delay: 0.2 },
  { id: 4, base: 12, active: [12, 28, 12], delay: 0.3 },
  { id: 5, base: 8, active: [8, 20, 8], delay: 0.4 },
];

export function LiveSessionCard({
  session,
  isSessionActive,
  microphoneStatus,
  screenShareStatus,
  isMicrophoneSupported,
  isScreenShareSupported,
  isBusy,
  provider,
  previewStream,
  onOpenOverlay,
  onToggleSession,
  onToggleMicrophone,
  onStartScreenShare,
  onStopScreenShare,
  onSendMessage,
}: LiveSessionCardProps) {
  const [draft, setDraft] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = draft.trim();
    if (!next || !onSendMessage) return;
    await onSendMessage(next);
    setDraft('');
  };

  const isMuted = microphoneStatus === 'muted' || microphoneStatus === 'idle';
  const isScreenSharing = screenShareStatus === 'sharing';
  const composerPlaceholder = getComposerPlaceholder(provider);
  const isConnecting = isBusy && !isSessionActive;
  const sessionToggleTitle = getSessionToggleTitle(isSessionActive);

  return (
    <div className="w-full h-full rounded-3xl border border-border/40 bg-card/60 backdrop-blur-3xl shadow-2xl overflow-hidden relative group flex flex-col">
      {isConnecting ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-3xl bg-background/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary/60 bg-primary/10">
                <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Connecting to Gemini Live...</p>
          </div>
        </div>
      ) : null}

      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleSession}
          disabled={isBusy}
          className={`p-2 rounded-full border transition-colors flex items-center justify-center shrink-0 ${isSessionActive ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20' : 'bg-secondary border-border text-blue-500 hover:bg-accent'}`}
          title={sessionToggleTitle}
        >
          {isSessionActive ? <Square size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
        </button>
        {isSessionActive && (
          <button
            type="button"
            onClick={onOpenOverlay}
            className="p-2 rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Expand to Full Screen"
          >
            <Maximize2 size={18} />
          </button>
        )}
      </div>

      <div className="w-full flex-1 bg-secondary relative flex flex-col items-center justify-center py-10 px-6 border-b border-border/50">
        {isSessionActive ? (
          <>
            {/* Screen-context active badge — multimodal key visual for demo */}
            {isScreenSharing && (
              <div className="absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-emerald-400 shadow-lg backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-semibold tracking-wide">Gemini sees your screen</span>
              </div>
            )}

            <div className="flex flex-col items-center justify-center relative w-full mb-6">
              <>
                {!isMuted && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute w-48 h-48 rounded-full bg-primary/20 blur-2xl pointer-events-none"
                  />
                )}
                <div className="relative w-32 h-32 rounded-full bg-card border border-border shadow-xl flex items-center justify-center overflow-hidden">
                  <div className="flex items-center justify-center gap-1 h-16">
                    {AUDIO_BARS.map((bar) => (
                      <motion.div
                        key={bar.id}
                        className={`w-1 rounded-full ${isMuted ? 'bg-muted-foreground/50' : 'bg-foreground'}`}
                        animate={{ height: isMuted ? bar.base : bar.active }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: bar.delay, ease: 'easeInOut' }}
                      />
                    ))}
                  </div>
                </div>
              </>
            </div>

            <div className="w-full max-w-lg mb-4 flex items-center justify-center gap-3 p-2 rounded-2xl bg-secondary/80 backdrop-blur-xl border border-border shadow-md">
              <button
                type="button"
                onClick={() => void onToggleMicrophone?.()}
                disabled={!isMicrophoneSupported}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${!isMicrophoneSupported ? 'opacity-50 cursor-not-allowed' : ''} ${isMuted ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-background shadow-sm text-foreground hover:bg-accent'}`}
                title={getMicrophoneLabel(microphoneStatus)}
              >
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <button
                type="button"
                onClick={isScreenSharing ? onStopScreenShare : () => void onStartScreenShare?.()}
                disabled={!isScreenShareSupported}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${!isScreenShareSupported ? 'opacity-50 cursor-not-allowed' : ''} ${isScreenSharing ? 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20' : 'bg-background shadow-sm text-foreground hover:bg-accent'}`}
                title={isScreenSharing ? 'Stop Sharing' : getScreenShareLabel(screenShareStatus)}
              >
                {isScreenSharing ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="w-full max-w-lg bg-secondary/80 backdrop-blur-xl rounded-2xl p-2 border border-border shadow-md flex items-center gap-2">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={composerPlaceholder}
                className="flex-1 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim() || !onSendMessage || isBusy}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
              >
                {isBusy ? 'Wait...' : 'Send'}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-background/5 border border-background/10 flex items-center justify-center mx-auto mb-6">
              <MicOff size={32} className="text-muted-foreground" />
            </div>
            <div className="text-xl font-medium tracking-tight text-foreground mb-2">Ready when you are</div>
            <div className="text-sm text-muted-foreground max-w-xs mb-8">
              Start a live session to talk with Crewmate using voice and screen share.
            </div>
            <button
              type="button"
              onClick={onToggleSession}
              disabled={isBusy}
              className="px-6 py-3 rounded-full btn-bevel btn-bevel-primary font-medium flex items-center gap-2"
            >
              <Play size={18} className="fill-current" />
              {isBusy ? 'Starting...' : 'Start Live Session'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
