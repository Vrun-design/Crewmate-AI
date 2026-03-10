import React from 'react';
import { Mic, Settings2, WandSparkles } from 'lucide-react';
import { StepShell } from './StepShell';

type StepTwoProps = {
  onManual: () => void;
  onVoice: () => void;
};

export function StepTwo({ onManual, onVoice }: StepTwoProps): React.JSX.Element {
  return (
    <StepShell className="w-full max-w-2xl space-y-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Choose setup method</h1>
        <p className="text-muted-foreground">Pick the path that matches how much you want to configure right now.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onVoice}
          className="group relative p-8 rounded-2xl border border-border bg-card/50 backdrop-blur-xl hover:border-foreground transition-all duration-300 shadow-xl shadow-black/5 hover:shadow-2xl hover:shadow-black/10 flex flex-col h-full overflow-hidden text-left"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-foreground/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="space-y-6 flex-1 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-foreground to-foreground/80 text-background flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,0.1)_inset,0_8px_20px_rgba(0,0,0,0.1)]">
              <Mic size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xl font-medium tracking-tight">Guided Live Setup</h3>
                <span className="px-2 py-0.5 rounded-full bg-foreground/10 text-foreground text-[10px] font-semibold tracking-widest uppercase border border-foreground/20 flex items-center gap-1">
                  <WandSparkles size={10} />
                  Real-time
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Start a real Gemini Live session from the dashboard. Crewmate will ask onboarding questions and summarize what still needs manual setup.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onManual}
          className="group relative p-8 rounded-2xl border border-border bg-background/50 backdrop-blur-xl hover:border-muted-foreground transition-all duration-300 shadow-sm hover:shadow-md flex flex-col h-full text-left"
        >
          <div className="space-y-6 flex-1 relative z-10">
            <div className="w-12 h-12 rounded-xl bg-secondary text-foreground flex items-center justify-center border border-border">
              <Settings2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-medium tracking-tight mb-3">Manual Setup</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add one piece of context now, review integration readiness, and continue with an honest setup state instead of simulated automation.
              </p>
            </div>
          </div>
        </button>
      </div>
    </StepShell>
  );
}
