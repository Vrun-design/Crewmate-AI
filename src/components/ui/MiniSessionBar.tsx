import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Square, Maximize2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveSessionContext } from '../../contexts/LiveSessionContext';

function isDashboardPath(pathname: string): boolean {
  return pathname === '/dashboard' || pathname === '/';
}

export function MiniSessionBar() {
  const {
    isSessionActive,
    elapsedLabel,
    microphoneStatus,
    isMicrophoneSupported,
    toggleMicrophone,
    endSession,
    stopMicrophone,
    stopScreenShare,
    setIsOverlayOpen,
    isOverlayOpen,
    liveTaskCue,
  } = useLiveSessionContext();
  const location = useLocation();
  const navigate = useNavigate();

  const isMuted = microphoneStatus === 'muted' || microphoneStatus === 'idle';
  const isOnDashboard = isDashboardPath(location.pathname);
  const isVisible = isSessionActive && !isOnDashboard && !isOverlayOpen;

  function handleEndSession() {
    void endSession();
    stopScreenShare();
    void stopMicrophone();
    setIsOverlayOpen(false);
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9998]"
        >
          <div className="flex flex-col gap-2">
            {liveTaskCue ? (
              <div className={`mx-auto rounded-full border px-3 py-1 text-xs ${
                liveTaskCue.status === 'completed'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              }`}>
                {liveTaskCue.status === 'completed' ? 'Task finished' : 'Task failed'}: {liveTaskCue.title}
              </div>
            ) : null}
            <div className="flex items-center gap-4 py-2 px-4 rounded-full bg-secondary/90 backdrop-blur-xl border border-border shadow-2xl ring-1 ring-white/5">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
              <div className="relative flex items-center justify-center w-3 h-3">
                <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-red-400"></span>
                <span className="relative inline-flex w-2 h-2 rounded-full bg-red-500"></span>
              </div>
              <span className="text-sm font-medium tabular-nums tracking-wider text-foreground">
                {elapsedLabel}
              </span>
            </div>

            <div className="w-px h-6 bg-border/50" />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => void toggleMicrophone()}
                disabled={!isMicrophoneSupported}
                title={isMuted ? 'Unmute' : 'Mute'}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  isMuted
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <button
                type="button"
                onClick={() => setIsOverlayOpen(true)}
                title="Expand to full screen overlay"
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all"
              >
                <Maximize2 size={16} />
              </button>

              <button
                type="button"
                onClick={handleEndSession}
                title="End session"
                className="w-9 h-9 rounded-full flex items-center justify-center bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-all ml-1"
              >
                <Square size={14} className="fill-current" />
              </button>
            </div>
          </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
