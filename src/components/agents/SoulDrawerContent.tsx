import React, { useState } from 'react';
import { Save, User, ShieldAlert, Cpu, SlidersHorizontal } from 'lucide-react';
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
  { label: 'Honest', text: "Never fabricates results or pretends tools work when they don't. Always speaks up when something fails." },
];

const CUSTOM_SOUL_PLACEHOLDER = `e.g. "Always call me by my first name. Keep responses punchy — I hate long monologues. When something fails, tell me immediately and give me options. Be a little witty but not cringe."`;

export function SoulDrawerContent({ profile, onSaved }: SoulDrawerContentProps): React.JSX.Element {
  const [agentName, setAgentName] = useState(profile?.agentName ?? 'Crewmate');
  const [userName, setUserName] = useState(profile?.userName ?? '');
  const [customSoul, setCustomSoul] = useState(profile?.customSoul ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasChanges =
    agentName.trim() !== (profile?.agentName ?? 'Crewmate') ||
    userName.trim() !== (profile?.userName ?? '') ||
    customSoul.trim() !== (profile?.customSoul ?? '');

  async function handleSave(): Promise<void> {
    if (!agentName.trim()) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const updatedProfile: OnboardingProfile = {
        ...(profile ?? { voiceModel: 'models/gemini-2.5-flash-native-audio-preview-12-2025' }),
        agentName: agentName.trim(),
        userName: userName.trim(),
        customSoul: customSoul.trim(),
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
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <User size={16} className="text-[#a63c1c]" />
          <h3 className="text-[13px] font-bold tracking-[0.08em] uppercase text-white/90">Identity</h3>
        </div>

        <div className="space-y-2">
          <label className="flex justify-between text-sm font-medium text-muted-foreground">
            <span>Your name</span>
            <span className="text-xs">Agent will call you by this</span>
          </label>
          <input
            type="text"
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            placeholder="e.g. Varun"
            className="w-full rounded-xl border border-white/10 bg-[#0f0f11] px-4 py-3.5 text-sm text-white/90 transition-all placeholder:text-white/30 focus:outline-none focus:border-[#a63c1c]/50 focus:ring-1 focus:ring-[#a63c1c]/50"
          />
        </div>

        <div className="space-y-2">
          <label className="flex justify-between text-sm font-medium text-muted-foreground">
            <span>Agent name</span>
            <span className="text-xs">Used in UI and Live voice</span>
          </label>
          <input
            type="text"
            value={agentName}
            onChange={(event) => setAgentName(event.target.value)}
            placeholder="e.g. Crewmate"
            className="w-full rounded-xl border border-white/10 bg-[#0f0f11] px-4 py-3.5 text-sm text-white/90 transition-all placeholder:text-white/30 focus:outline-none focus:border-[#a63c1c]/50 focus:ring-1 focus:ring-[#a63c1c]/50"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <SlidersHorizontal size={16} className="text-violet-400" />
          <h3 className="text-[13px] font-bold tracking-[0.08em] uppercase text-white/90">Personality</h3>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Tell your agent how you like to work. This gets injected directly into every session — the agent will follow these instructions.
        </p>

        <textarea
          value={customSoul}
          onChange={(event) => setCustomSoul(event.target.value)}
          placeholder={CUSTOM_SOUL_PLACEHOLDER}
          rows={6}
          className="w-full rounded-xl border border-white/10 bg-[#0f0f11] px-4 py-4 text-[13.5px] text-white/90 transition-all placeholder:text-white/30 focus:outline-none focus:border-[#a63c1c]/50 focus:ring-1 focus:ring-[#a63c1c]/50 resize-none leading-relaxed"
        />
      </div>

      {saveError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {saveError}
        </div>
      ) : null}

      <Button
        variant="primary"
        className="w-full gap-2 py-5 rounded-xl bg-[#bd4521] hover:bg-[#a63c1c] text-white/90 border-0 font-medium"
        onClick={() => void handleSave()}
        disabled={isSaving || !hasChanges}
      >
        <Save size={16} className="text-white/70" />
        {isSaving ? 'Saving...' : 'Save'}
      </Button>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <ShieldAlert size={16} className="text-emerald-500" />
          <h3 className="text-[13px] font-bold tracking-[0.08em] uppercase text-white/90">Core Architecture (SOUL.md)</h3>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Permanently injected into every agent to guarantee safety and consistency. Cannot be overridden.
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
