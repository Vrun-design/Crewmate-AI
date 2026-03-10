import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronRight, Sparkles, Zap } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { usePersonas } from '../hooks/usePersonas';

const PERSONA_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
    developer: { bg: 'bg-blue-500/10', border: 'border-blue-500/40', glow: 'shadow-blue-500/20' },
    marketer: { bg: 'bg-orange-500/10', border: 'border-orange-500/40', glow: 'shadow-orange-500/20' },
    founder: { bg: 'bg-purple-500/10', border: 'border-purple-500/40', glow: 'shadow-purple-500/20' },
    sales: { bg: 'bg-green-500/10', border: 'border-green-500/40', glow: 'shadow-green-500/20' },
    designer: { bg: 'bg-pink-500/10', border: 'border-pink-500/40', glow: 'shadow-pink-500/20' },
};

export function Personas() {
    const { personas, activePersonaId, activePersona, isLoading, isSwitching, error, switchPersona } = usePersonas();
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const displayId = selectedId ?? activePersonaId;
    const displayPersona = personas.find((p) => p.id === displayId) ?? activePersona;

    async function handleConfirmSwitch() {
        if (!selectedId || selectedId === activePersonaId) return;
        await switchPersona(selectedId);
        setSelectedId(null);
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <PageHeader title="Persona" description="Loading your agent configurations..." />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-40 rounded-2xl bg-card animate-pulse border border-border" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <PageHeader
                title="Persona"
                description="Tell Crewmate who you are. It will switch its expertise, proactive behavior, and tool priorities accordingly."
            />

            {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            {/* Persona grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {personas.map((persona) => {
                    const colors = PERSONA_COLORS[persona.id] ?? { bg: 'bg-card', border: 'border-border', glow: '' };
                    const isActive = persona.id === activePersonaId;
                    const isSelected = persona.id === displayId;

                    return (
                        <button
                            key={persona.id}
                            type="button"
                            onClick={() => setSelectedId(persona.id)}
                            className={`relative text-left p-6 rounded-2xl border transition-all duration-200 group ${isSelected
                                    ? `${colors.bg} ${colors.border} shadow-lg ${colors.glow}`
                                    : 'bg-card border-border hover:border-muted-foreground/40'
                                }`}
                        >
                            {isActive && (
                                <span className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-foreground/10 border border-foreground/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                                    <Zap size={9} className="fill-current" />
                                    Active
                                </span>
                            )}

                            <div className="mb-4 text-3xl">{persona.emoji}</div>
                            <div className="font-semibold text-foreground text-base mb-1">{persona.name}</div>
                            <div className="text-sm text-muted-foreground leading-relaxed">{persona.tagline}</div>

                            {isSelected && (
                                <motion.div
                                    layoutId="persona-selection-indicator"
                                    className={`absolute inset-0 rounded-2xl border-2 pointer-events-none ${colors.border}`}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Detail panel + confirm button */}
            <AnimatePresence>
                {displayPersona && (
                    <motion.div
                        key={displayPersona.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                    >
                        {/* Example commands */}
                        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Sparkles size={14} className="text-muted-foreground" />
                                Example commands
                            </div>
                            <div className="space-y-2">
                                {displayPersona.exampleCommands.map((cmd) => (
                                    <div key={cmd} className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <ChevronRight size={14} className="mt-0.5 shrink-0 text-foreground/40" />
                                        <span className="font-mono text-[13px]">{cmd}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Proactive triggers */}
                        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
                            <div className="text-sm font-medium text-foreground">Proactive on screen</div>
                            <div className="flex flex-wrap gap-2">
                                {displayPersona.proactiveTriggers.map((trigger) => (
                                    <span key={trigger} className="rounded-full bg-secondary border border-border px-3 py-1 text-xs text-muted-foreground">
                                        {trigger}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Preferred tools + action */}
                        <div className="bg-card border border-border rounded-2xl p-6 space-y-4 flex flex-col">
                            <div className="text-sm font-medium text-foreground">Preferred integrations</div>
                            <div className="flex flex-wrap gap-2 flex-1">
                                {displayPersona.preferredTools.map((tool) => (
                                    <span key={tool} className="rounded-lg bg-secondary border border-border px-3 py-1.5 text-xs font-medium text-foreground capitalize">
                                        {tool}
                                    </span>
                                ))}
                            </div>

                            {selectedId && selectedId !== activePersonaId ? (
                                <button
                                    type="button"
                                    onClick={() => void handleConfirmSwitch()}
                                    disabled={isSwitching}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-foreground text-background py-3 text-sm font-medium transition-all hover:bg-foreground/90 disabled:opacity-50"
                                >
                                    {isSwitching ? (
                                        'Switching...'
                                    ) : (
                                        <>
                                            <Check size={14} />
                                            Switch to {displayPersona.name}
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="w-full rounded-xl bg-secondary/50 border border-border py-3 text-center text-sm text-muted-foreground">
                                    {displayPersona.id === activePersonaId ? '✓ Currently active' : 'Select above to switch'}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
