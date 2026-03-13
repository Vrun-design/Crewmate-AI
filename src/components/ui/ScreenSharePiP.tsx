import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Mic, MicOff, ScreenShareOff, Maximize2, PictureInPicture2 } from 'lucide-react';
import type { MicrophoneStatus, ScreenShareStatus } from '../../types/live';

interface ScreenSharePiPProps {
  previewStream: MediaStream | null;
  screenShareStatus: ScreenShareStatus;
  microphoneStatus: MicrophoneStatus;
  isMicrophoneSupported: boolean;
  onToggleMicrophone: () => Promise<void> | void;
  onStopScreenShare: () => void;
  onOpenOverlay: () => void;
}

export function ScreenSharePiP({
  previewStream,
  screenShareStatus,
  microphoneStatus,
  isMicrophoneSupported,
  onToggleMicrophone,
  onStopScreenShare,
  onOpenOverlay,
}: ScreenSharePiPProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPiPSupported] = useState(() => document.pictureInPictureEnabled);
  const [isPiPActive, setIsPiPActive] = useState(false);

  const isVisible = screenShareStatus === 'sharing' && !!previewStream;
  const isMuted = microphoneStatus === 'muted' || microphoneStatus === 'idle';

  const setVideoRef = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video;
    if (video && previewStream) {
      video.srcObject = previewStream;
      void video.play().catch(() => {});
    }
  }, [previewStream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!previewStream) {
      video.srcObject = null;
      return;
    }

    if (video.srcObject !== previewStream) {
      video.srcObject = previewStream;
      void video.play().catch(() => {});
    }
  }, [previewStream]);

  useEffect(() => {
    const handler = () => setIsPiPActive(false);
    document.addEventListener('leavepictureinpicture', handler);
    return () => document.removeEventListener('leavepictureinpicture', handler);
  }, []);

  async function handleNativePiP() {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
      } else {
        await video.requestPictureInPicture();
        setIsPiPActive(true);
      }
    } catch {
      // PiP not available for this frame — silently ignore
    }
  }

  if (!isVisible) return null;

  return createPortal(
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="fixed bottom-6 right-6 z-[9999] select-none cursor-grab active:cursor-grabbing"
      style={{ width: 280 }}
    >
      <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/95 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <video
              ref={setVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
            />
          </div>

          <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 pointer-events-none">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wider">Live</span>
          </div>

          <div className="absolute top-2 right-2 pointer-events-none">
            <div className="w-4 h-4 opacity-30 flex flex-col gap-[2px] justify-center items-center">
              <div className="w-3 h-[1.5px] bg-white rounded" />
              <div className="w-3 h-[1.5px] bg-white rounded" />
              <div className="w-3 h-[1.5px] bg-white rounded" />
            </div>
          </div>
        </div>

        {/* Controls dock */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/5">
          <span className="text-[10px] text-white/40 font-medium tracking-wide">Screen sharing</span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => void onToggleMicrophone()}
              disabled={!isMicrophoneSupported}
              title={isMuted ? 'Unmute' : 'Mute'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                isMuted
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
            </button>

            <button
              onClick={onOpenOverlay}
              title="Expand to full screen"
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 text-white/70 hover:bg-white/20 transition-all"
            >
              <Maximize2 size={13} />
            </button>

            {isPiPSupported && (
              <button
                onClick={() => void handleNativePiP()}
                title={isPiPActive ? 'Return to tab' : 'Pop out (Picture in Picture)'}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isPiPActive
                    ? 'bg-blue-500/30 text-blue-400'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                <PictureInPicture2 size={13} />
              </button>
            )}

            <button
              onClick={onStopScreenShare}
              title="Stop screen share"
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
            >
              <ScreenShareOff size={13} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>,
    document.body,
  );
}
