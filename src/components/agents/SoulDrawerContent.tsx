import React, { useState } from 'react';
import { Save, User, ShieldAlert, Cpu } from 'lucide-react';
import { Button } from '../ui/Button';
import { PropertyRow } from '../ui/PropertyRow';
import { onboardingService, type OnboardingProfile } from '../../services/onboardingService';

interface SoulDrawerContentProps {
  profile: OnboardingProfile | null;
  onSaved: (newProfile: OnboardingProfile) => void;
}

const HARDCODED_SOUL_TRAITS = [
  { label: 'Voice', text: 'Direct, warm, concise. No corporate speak.' },
  { label: 'Proactive', text: 'Notices things before asked. Spots issues on screen.' },
  { label: 'Respectful', text: 'Asks before irreversible actions like sending emails or running CLI commands.' },
  { label: 'Honest', text: 'Never fabricates results or pretends tools work when they don\'t.' },
];

export function SoulDrawerContent({ profile, onSaved }: SoulDrawerContentProps): React.JSX.Element {
  const [name, setName] = useState(profile?.agentName ?? 'Crewmate');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    if (!name.trim()) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const updatedProfile = {
        ...(profile ?? { voiceModel: 'models/gemini-2.5-flash-native-audio-preview-12-2025' }),
        agentName: name.trim(),
      };
      await onboardingService.saveProfile(updatedProfile);
      onSaved(updatedProfile);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save identity');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <User size={16} className="text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Dynamic Identity</h3>
        </div>

        <div className="space-y-2">
          <label className="flex justify-between text-sm font-medium text-muted-foreground">
            <span>Agent Name</span>
            <span className="text-xs">Used in UI and Live voice sessions</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Crewmate, Jarvis, Hal"
            className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground transition-all focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {saveError ? (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {saveError}
          </div>
        ) : null}

        <Button
          variant="primary"
          className="w-full gap-2 py-5"
          onClick={() => void handleSave()}
          disabled={isSaving || name.trim() === profile?.agentName}
        >
          <Save size={16} />
          {isSaving ? 'Updating...' : 'Save Identity'}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <ShieldAlert size={16} className="text-emerald-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Core Architecture (SOUL.md)</h3>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          This core identity is permanently injected into the Orchestrator and every specialist agent to guarantee safety and consistency. It cannot be overridden.
        </p>

        <div className="rounded-xl border border-border/50 bg-secondary/20 px-4 py-1">
          {HARDCODED_SOUL_TRAITS.map((trait) => (
            <PropertyRow key={trait.label} icon={Cpu} label={trait.label}>
              {trait.text}
            </PropertyRow>
          ))}
        </div>
      </div>
    </div>
  );
}
