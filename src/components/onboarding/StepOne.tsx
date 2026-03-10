import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { LIVE_VOICE_OPTIONS } from '../../constants/liveVoices';
import { StepShell } from './StepShell';

type StepOneProps = {
  agentName: string;
  setAgentName: React.Dispatch<React.SetStateAction<string>>;
  voice: string;
  setVoice: React.Dispatch<React.SetStateAction<string>>;
  onNext: () => void;
};

export function StepOne({ agentName, setAgentName, voice, setVoice, onNext }: StepOneProps): React.JSX.Element {
  return (
    <StepShell className="w-full max-w-xl space-y-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Create your agent</h1>
        <p className="text-muted-foreground">Set the identity Crewmate should use when it talks, summarizes, and asks for permission.</p>
      </div>

      <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl shadow-black/5 space-y-8">
        <div className="space-y-3">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Agent Name</label>
          <input
            type="text"
            value={agentName}
            onChange={(event) => setAgentName(event.target.value)}
            className="w-full bg-background/50 border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground transition-all shadow-sm"
          />
        </div>

        <div className="space-y-3">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Voice Personality</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LIVE_VOICE_OPTIONS.map((voiceOption) => (
              <button
                type="button"
                key={voiceOption.value}
                onClick={() => {
                  setVoice(voiceOption.value);
                  const preview = new Audio(`/assets/voices/${voiceOption.value.toLowerCase()}.wav`);
                  preview.play().catch(e => console.warn('Missing voice preview preview file:', e));
                }}
                className={`p-4 rounded-xl border text-left transition-all duration-200 relative overflow-hidden ${voice === voiceOption.value ? 'border-foreground bg-foreground/5 shadow-sm' : 'border-border bg-background/50 hover:border-muted-foreground/50'
                  }`}
              >
                {voice === voiceOption.value ? (
                  <motion.div layoutId="voice-active" className="absolute inset-0 border-2 border-foreground rounded-xl pointer-events-none" />
                ) : null}
                <div className="flex items-center justify-between mb-1 relative z-10">
                  <div className="font-medium text-sm text-foreground">{voiceOption.label}</div>
                  {voice === voiceOption.value ? <CheckCircle2 size={16} className="text-foreground" /> : null}
                </div>
                <div className="text-xs text-muted-foreground relative z-10">{voiceOption.description}</div>
                <div className="mt-4 text-[11px] font-medium text-muted-foreground relative z-10 uppercase tracking-wider whitespace-nowrap">
                  Gemini Live Voice
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="primary" onClick={onNext} className="px-8 py-5 text-sm font-medium shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
          Continue
        </Button>
      </div>
    </StepShell>
  );
}
