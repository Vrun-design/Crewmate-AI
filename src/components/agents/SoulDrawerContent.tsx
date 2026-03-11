import React, { useState } from 'react';
import { Save, User, ShieldAlert, Cpu } from 'lucide-react';
import { Button } from '../ui/Button';
import { onboardingService, type OnboardingProfile } from '../../services/onboardingService';

interface SoulDrawerContentProps {
    profile: OnboardingProfile | null;
    onSaved: (newProfile: OnboardingProfile) => void;
}

const HARDCODED_SOUL_TRAITS = [
    { label: 'Voice', text: 'Direct, warm, concise. No corporate speak.' },
    { label: 'Proactive', text: 'Notices things before asked. Spots issues on screen.' },
    { label: 'Respectful', text: 'Asks before irreversible actions like sending emails or running CLI commands.' },
    { label: 'Honest', text: 'Never fabricates results or pretends tools work when they don\'t.' }
];

export function SoulDrawerContent({ profile, onSaved }: SoulDrawerContentProps): React.JSX.Element {
    const [name, setName] = useState(profile?.agentName ?? 'Crewmate');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    async function handleSave(): Promise<void> {
        if (!name.trim()) return;
        setIsSaving(true);
        setSaveError(null);

        try {
            const updatedProfile = {
                ...(profile ?? { voiceModel: 'models/gemini-2.5-flash-native-audio-preview-12-2025' }),
                agentName: name.trim()
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
            {/* Identity Configuration */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                    <User size={16} className="text-primary" />
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Dynamic Identity</h3>
                </div>
                
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground flex justify-between">
                        <span>Agent Name</span>
                        <span className="text-xs">Used in UI and Live voice sessions</span>
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Crewmate, Jarvis, Hal"
                        className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 text-foreground transition-all"
                    />
                </div>

                {saveError && (
                    <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20">
                        {saveError}
                    </div>
                )}

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

            {/* Hardcoded Soul Architecture (Read Only) */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                    <ShieldAlert size={16} className="text-emerald-500" />
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Core Architecture (SOUL.md)</h3>
                </div>
                
                <p className="text-xs text-muted-foreground leading-relaxed">
                    This core identity is permanently injected into the Orchestrator and every specialist agent to guarantee safety and consistency. It cannot be overridden.
                </p>

                <div className="space-y-3">
                    {HARDCODED_SOUL_TRAITS.map((trait, i) => (
                        <div key={i} className="bg-secondary/30 border border-border rounded-lg p-3 flex gap-3">
                            <Cpu size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                                <span className="text-xs font-semibold text-foreground block mb-0.5">{trait.label}</span>
                                <span className="text-xs text-muted-foreground">{trait.text}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
