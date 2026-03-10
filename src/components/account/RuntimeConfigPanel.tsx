import React from 'react';
import { Cpu, Image as ImageIcon, MessageSquare, WandSparkles } from 'lucide-react';
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
  { tier: 'live', model: 'gemini-2.5-flash-native-audio-preview', note: 'Real-time voice' },
  { tier: 'orchestration', model: 'gemini-3.1-pro-preview', note: 'Intent routing' },
  { tier: 'research', model: 'gemini-3.1-pro-preview', note: 'Deep analysis' },
  { tier: 'creative', model: 'gemini-3.1-flash-image-preview', note: 'Image gen' },
  { tier: 'quick', model: 'gemini-3.1-flash-lite-preview', note: 'Fast tasks' },
  { tier: 'lite', model: 'gemini-3.1-flash-lite-preview', note: 'Ultra-fast' },
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
        <h2 className="text-lg font-semibold text-foreground mb-1">Runtime Configuration</h2>
        <p className="text-sm text-muted-foreground mb-1">
          Only live voice is user-configurable in this build. The rest of the runtime model stack is environment-managed.
        </p>
        <div className="rounded-lg bg-blue-500/5 border border-blue-500/15 px-3 py-2 text-xs text-blue-400 mb-6">
          Runtime model overrides are currently controlled by `GEMINI_*` environment variables in <code>.env</code>.
        </div>
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          <div className="p-5 flex items-start gap-4">
            <div className="mt-0.5 p-2 bg-blue-500/10 text-blue-500 rounded-lg shrink-0">
              <Cpu size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <label className="text-sm font-medium text-foreground">Orchestration</label>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/15">ROUTING</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Intent classification, agent routing, and planning are currently controlled by the server environment, not by per-user settings.
              </p>
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                Environment-managed model stack. This selector is intentionally not editable until per-user runtime routing is implemented.
              </div>
            </div>
          </div>

          <div className="p-5 flex items-start gap-4">
            <div className="mt-0.5 p-2 bg-purple-500/10 text-purple-500 rounded-lg shrink-0">
              <WandSparkles size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <label className="text-sm font-medium text-foreground">Research & Content</label>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/15">DEEP WORK</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Research, content, legal, and finance generation are also environment-managed in this build.
              </p>
              <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                Per-user deep-work model overrides are not active yet, so this setting is intentionally read-only.
              </div>
            </div>
          </div>

          <div className="p-5 flex items-start gap-4">
            <div className="mt-0.5 p-2 bg-rose-500/10 text-rose-500 rounded-lg shrink-0">
              <ImageIcon size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <label className="text-sm font-medium text-foreground">Creative Studio (Image)</label>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/15">VISUAL</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Social media images, banners, UI mockups, product visuals.</p>
              <Select
                value="gemini-3.1-flash-image-preview"
                onChange={() => undefined}
                options={[{ value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image Preview  ★ Only option' }]}
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">Image generation model is fixed — set via GEMINI_CREATIVE_MODEL env var.</p>
            </div>
          </div>

          <div className="p-5 flex items-start gap-4">
            <div className="mt-0.5 p-2 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
              <MessageSquare size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <label className="text-sm font-medium text-foreground">Live Voice (Gemini Live API)</label>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/15">VOICE</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Voice used during real-time screen-share sessions via Gemini Live. This preference is active.
              </p>
              <Select
                value={currentPreferences.voiceModel}
                onChange={(value) => void updatePreferences({ voiceModel: value })}
                options={LIVE_VOICE_OPTIONS.map((voiceOption, index) => ({
                  value: voiceOption.value,
                  label: `${voiceOption.label} — ${voiceOption.description}${index === 0 ? '  ★ Recommended' : ''}`,
                }))}
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Voices are official Gemini Live API voices and now apply to new live sessions started from this account.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border border-border bg-card/30 p-4 space-y-2">
        <p className="text-xs font-semibold text-foreground">How model routing works</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODEL_ROUTING_ROWS.map(({ tier, model, note }) => (
            <div key={tier} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">{tier}</span>
              <div className="text-right">
                <p className="text-[10px] font-mono text-foreground">{model.replace('gemini-', '')}</p>
                <p className="text-[9px] text-muted-foreground">{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isPreferencesLoading || isPreferencesSaving ? (
        <div className="text-sm text-muted-foreground">{isPreferencesLoading ? 'Loading preferences…' : 'Saving…'}</div>
      ) : null}
    </div>
  );
}
