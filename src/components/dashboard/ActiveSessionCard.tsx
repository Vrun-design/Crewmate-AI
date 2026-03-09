import React from 'react';
import {Mic, MonitorUp} from 'lucide-react';
import {motion} from 'motion/react';
import {CardContent} from '../ui/Card';
import type {LiveSession} from '../../types/live';
import {getSessionProviderLabel, getSessionStatusLabel} from './dashboardUtils';

interface ActiveSessionCardProps {
  session: LiveSession | null;
  isSessionActive: boolean;
  elapsedLabel: string;
}

export function ActiveSessionCard({
  session,
  isSessionActive,
  elapsedLabel,
}: ActiveSessionCardProps): React.ReactNode {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden relative group flex flex-col">
      <div className="w-full h-[320px] lg:h-[400px] bg-secondary relative flex items-center justify-center border-b border-border overflow-hidden">
        {isSessionActive ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-full h-full opacity-30 bg-[url('https://images.unsplash.com/photo-1618401471353-b98a52333646?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-secondary via-transparent to-transparent"></div>

            <motion.div
              initial={{scale: 0.9, opacity: 0}}
              animate={{scale: 1, opacity: 1}}
              className="z-10 flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-full bg-background/50 border border-border flex items-center justify-center mb-4 backdrop-blur-md shadow-lg">
                <MonitorUp size={24} className="text-blue-500" />
              </div>
              <div className="text-lg font-medium tracking-tight text-foreground">Screen Sharing Active</div>
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
            <div className="text-sm text-muted-foreground/60 mt-1">Click Start Live Session to begin screen sharing</div>
          </div>
        )}
      </div>

      <div className="p-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isSessionActive
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
          <div className="flex items-center gap-1 h-6 px-4" aria-label="audio-activity">
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
    </div>
  );
}
