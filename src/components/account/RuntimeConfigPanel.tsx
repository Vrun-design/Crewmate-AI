import React from 'react';
import { Cpu, Layers, MessageSquare, Zap } from 'lucide-react';
import { LIVE_VOICE_OPTIONS } from '../../constants/liveVoices';
import { Card, CardContent } from '../ui/Card';
import { Select } from '../ui/Select';
import type { AccountPreferences } from './accountTypes';

type RuntimeConfigPanelProps = {
  currentPreferences: AccountPreferences;
  isPreferencesLoading: boolean;
  isPreferencesSaving: boolean;
  updatePreferences: (patch: Partial<AccountPreferences>) => Promise<void>;
};

const MODEL_ROUTING_ROWS = [
  { tier: 'Orchestration', model: 'Gemini 3.1 Pro (Preview)', icon: Layers, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { tier: 'Research & Content', model: 'Gemini 3.1 Pro (Preview)', icon: Cpu, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { tier: 'Quick Tasks', model: 'Gemini 3.1 Flash Lite', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
] as const;

export function RuntimeConfigPanel({
  currentPreferences,
  isPreferencesLoading,
  isPreferencesSaving,
  updatePreferences,
}: RuntimeConfigPanelProps): React.JSX.Element {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-1">Active Model Stack</h2>
        <p className="text-sm text-muted-foreground/80 mb-6">
          Review the AI models powering your workspace. Voice is customizable; logic routing is managed natively.
        </p>
      </div>

      <Card className="overflow-hidden border-border/40 shadow-sm">
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {/* Live Voice Section - Interactive */}
            <div className="p-5 sm:p-6 bg-muted/5 hover:bg-muted/10 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="mt-0.5 p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl shrink-0 self-start">
                  <MessageSquare size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-sm font-medium text-foreground">Live Voice</label>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">CONFIGURABLE</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select your preferred agent voice for real-time Live sessions.
                  </p>
                  <div className="max-w-md">
                    <Select
                      value={currentPreferences.voiceModel}
                      onChange={(value) => void updatePreferences({ voiceModel: value })}
                      options={LIVE_VOICE_OPTIONS.map((voiceOption, index) => ({
                        value: voiceOption.value,
                        label: `${voiceOption.label} — ${voiceOption.description}${index === 0 ? '  ★ Recommended' : ''}`,
                      }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Read Only Models */}
            {MODEL_ROUTING_ROWS.map(({ tier, model, icon: Icon, color, bg }) => (
              <div key={tier} className="p-5 sm:p-6 flex items-center gap-4 hover:bg-muted/5 transition-colors">
                <div className={`mt-0.5 p-2.5 rounded-xl shrink-0 ${bg} ${color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-sm font-medium text-foreground">{tier}</label>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">MANAGED</span>
                    </div>
                  </div>
                  <div className="text-sm font-mono text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/40 truncate">
                    {model}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isPreferencesLoading || isPreferencesSaving ? (
        <div className="text-xs text-muted-foreground opacity-60 px-1">{isPreferencesLoading ? 'Loading current settings…' : 'Saving changes…'}</div>
      ) : null}
    </div>
  );
}
