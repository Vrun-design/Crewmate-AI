import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe,
  Maximize2,
  Minimize2,
  X,
  Loader2,
  MonitorPlay,
  ChevronRight,
} from 'lucide-react';
import { useBrowserSession } from '../../hooks/useBrowserSession';
import { cn } from '../../utils/cn';

function getShortLabel(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

// ── Status indicator ──────────────────────────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  if (status === 'running' || status === 'queued') {
    return (
      <span className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
          {status === 'queued' ? 'Starting' : 'Live'}
        </span>
      </span>
    );
  }
  if (status === 'completed') {
    return <span className="text-[9px] font-semibold uppercase tracking-wider text-blue-400">Done</span>;
  }
  if (status === 'failed') {
    return <span className="text-[9px] font-semibold uppercase tracking-wider text-red-400">Failed</span>;
  }
  return null;
}

// ── Fullscreen overlay ────────────────────────────────────────────────────────

function FullscreenOverlay({
  screenshotUrl,
  currentUrl,
  stepCount,
  intent,
  status,
  onClose,
}: {
  screenshotUrl: string | null;
  currentUrl: string | null;
  stepCount: number;
  intent: string;
  status: string;
  onClose: () => void;
}) {
  return createPortal(
    <AnimatePresence>
      <motion.div
        key="browser-fullscreen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="relative w-full max-w-5xl bg-[#0a0a0a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-white/5 border border-white/10">
                <MonitorPlay size={12} className="text-emerald-400" />
                <span className="text-[10px] font-semibold text-white/70 tracking-wide">Browser Session</span>
              </div>
              <StatusDot status={status} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                <span>Step {stepCount}</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex" style={{ height: 540 }}>
            {/* Screenshot pane */}
            <div className="flex-1 relative bg-black flex items-center justify-center border-r border-white/8">
              {screenshotUrl ? (
                <img
                  src={screenshotUrl}
                  alt="Browser session"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-white/30">
                  <Loader2 size={28} className="animate-spin" />
                  <span className="text-xs">Waiting for first screenshot...</span>
                </div>
              )}

              {/* URL bar overlay */}
              {currentUrl && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-sm border border-white/15 max-w-[90%]">
                  <Globe size={11} className="text-white/50 flex-shrink-0" />
                  <span className="text-[11px] text-white/70 truncate font-mono">{currentUrl}</span>
                </div>
              )}
            </div>

            {/* Info pane */}
            <div className="w-64 flex flex-col p-4 gap-4">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Task</p>
                <p className="text-sm text-white/85 leading-snug line-clamp-4">{intent}</p>
              </div>
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Progress</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-emerald-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((stepCount / 30) * 100, 100)}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <span className="text-[11px] text-white/50">{stepCount}/30</span>
                </div>
              </div>
              <div className="mt-auto p-3 rounded-xl bg-white/[0.04] border border-white/8">
                <p className="text-[10px] text-white/40 mb-1">Powered by</p>
                <div className="flex items-center gap-1.5">
                  <MonitorPlay size={11} className="text-blue-400" />
                  <span className="text-[11px] text-white/70 font-medium">UI Navigator Agent</span>
                </div>
                <p className="text-[10px] text-white/35 mt-1">Stagehand + Gemini</p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

// ── Main PiP ──────────────────────────────────────────────────────────────────

export function BrowserSessionPiP(): React.JSX.Element | null {
  const { active, snapshot } = useBrowserSession();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!active || !snapshot) return null;

  const isDone = snapshot.status === 'completed' || snapshot.status === 'failed' || snapshot.status === 'cancelled';
  const shortUrl = snapshot.currentUrl
    ? getShortLabel(snapshot.currentUrl.replace(/^https?:\/\//, ''), 36)
    : null;
  const shortIntent = getShortLabel(active.intent, 52);

  return (
    <>
      {isFullscreen && (
        <FullscreenOverlay
          screenshotUrl={snapshot.screenshotUrl}
          currentUrl={snapshot.currentUrl}
          stepCount={snapshot.stepCount}
          intent={active.intent}
          status={snapshot.status}
          onClose={() => setIsFullscreen(false)}
        />
      )}

      {createPortal(
        <motion.div
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 24 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className="fixed bottom-6 left-6 z-[9998] select-none cursor-grab active:cursor-grabbing"
          style={{ width: isMinimized ? 220 : 296 }}
        >
          <div className={cn(
            'rounded-2xl overflow-hidden border border-white/10 bg-[#0c0c0e]/98 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5',
            isDone && 'border-white/5 opacity-80',
          )}>
            {/* Header — always visible */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/6">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-md bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                  <MonitorPlay size={11} className="text-emerald-400" />
                </div>
                <StatusDot status={snapshot.status} />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title={isMinimized ? 'Expand' : 'Minimize'}
                  onClick={() => setIsMinimized((v) => !v)}
                  className="w-6 h-6 rounded-md flex items-center justify-center bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80 transition-all"
                >
                  {isMinimized ? <ChevronRight size={11} /> : <Minimize2 size={11} />}
                </button>
                <button
                  type="button"
                  title="Fullscreen"
                  onClick={() => setIsFullscreen(true)}
                  className="w-6 h-6 rounded-md flex items-center justify-center bg-white/8 text-white/50 hover:bg-white/15 hover:text-white/80 transition-all"
                >
                  <Maximize2 size={11} />
                </button>
                <button
                  type="button"
                  title="Dismiss"
                  onClick={() => { import('../../stores/browserSessionStore').then(({ browserSessionStore: s }) => s.clear()); }}
                  className="w-6 h-6 rounded-md flex items-center justify-center bg-white/8 text-white/50 hover:bg-red-500/30 hover:text-red-400 transition-all"
                >
                  <X size={11} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Screenshot */}
                <div className="relative bg-black" style={{ paddingBottom: '56.25%' }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    {snapshot.screenshotUrl ? (
                      <motion.img
                        key={snapshot.screenshotUrl}
                        src={snapshot.screenshotUrl}
                        alt="Browser"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-white/25">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-[10px]">Starting browser...</span>
                      </div>
                    )}
                  </div>

                  {/* Step badge */}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 pointer-events-none">
                    <span className="text-[9px] font-mono text-white/60">
                      {snapshot.stepCount} steps
                    </span>
                  </div>
                </div>

                {/* Meta footer */}
                <div className="px-3 py-2 space-y-1">
                  {shortUrl && (
                    <div className="flex items-center gap-1.5">
                      <Globe size={9} className="text-white/30 flex-shrink-0" />
                      <span className="text-[10px] font-mono text-white/45 truncate">{shortUrl}</span>
                    </div>
                  )}
                  <p className="text-[11px] text-white/60 leading-snug line-clamp-2">{shortIntent}</p>
                </div>
              </>
            )}
          </div>
        </motion.div>,
        document.body,
      )}
    </>
  );
}
