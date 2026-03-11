import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Toggle } from '../ui/Toggle';
import type { AccountPreferences } from './accountTypes';

type PreferencesPanelProps = {
  currentPreferences: AccountPreferences;
  isPreferencesLoading: boolean;
  isPreferencesSaving: boolean;
  updatePreferences: (patch: Partial<AccountPreferences>) => Promise<void>;
};

export function PreferencesPanel({
  currentPreferences,
  isPreferencesLoading,
  isPreferencesSaving,
  updatePreferences,
}: PreferencesPanelProps): React.JSX.Element {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">Preferences & Privacy</h2>
        <p className="text-sm text-muted-foreground mb-6">Customize how the agent interacts with your workspace.</p>
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          <div className="p-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">Proactive Suggestions</div>
              <div className="text-xs text-muted-foreground mt-1">Agent will suggest tasks based on screen context.</div>
            </div>
            <Toggle checked={currentPreferences.proactiveSuggestions} onChange={(value) => void updatePreferences({ proactiveSuggestions: value })} />
          </div>
          <div className="p-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">Auto-start Screen Share</div>
              <div className="text-xs text-muted-foreground mt-1">Prompt for screen sharing as soon as a live session starts.</div>
            </div>
            <Toggle checked={currentPreferences.autoStartScreenShare} onChange={(value) => void updatePreferences({ autoStartScreenShare: value })} />
          </div>
          <div className="p-6 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-4">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-foreground" />
              <div>
                <div className="text-sm font-medium text-foreground">Capture safeguards</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Microphone capture now starts with the live session for faster voice interaction. Screen share can start automatically if you enable it here. Sensitive-field redaction still is not implemented, so review what is on screen before sharing.
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isPreferencesLoading || isPreferencesSaving ? (
        <div className="text-sm text-muted-foreground">{isPreferencesLoading ? 'Loading preferences...' : 'Saving preferences...'}</div>
      ) : null}
    </div>
  );
}
