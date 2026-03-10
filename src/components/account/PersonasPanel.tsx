import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, ChevronRight, Code, Megaphone, Palette, Rocket, WandSparkles, Zap } from 'lucide-react';
import { usePersonas } from '../../hooks/usePersonas';

const PERSONA_ICONS: Record<string, React.ReactNode> = {
    developer: <Code size={20} strokeWidth={1.5} />,
    marketer: <Megaphone size={20} strokeWidth={1.5} />,
    founder: <Rocket size={20} strokeWidth={1.5} />,
    sales: <Briefcase size={20} strokeWidth={1.5} />,
    designer: <Palette size={20} strokeWidth={1.5} />,
};

export function PersonasPanel() {
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-36 rounded-xl bg-secondary animate-pulse border border-border" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-10">
            <div>
                <h2 className="text-[17px] font-semibold text-foreground mb-1">Personas</h2>
                <p className="text-sm text-muted-foreground">Switch Crewmate's expertise, priorities, and proactive triggers.</p>
            </div>

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground">
                    {error}
                </div>
            )}

            {/* Persona grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {personas.map((persona) => {
                    const isActive = persona.id === activePersonaId;
                    const isSelected = persona.id === displayId;
                    const Icon = PERSONA_ICONS[persona.id] ?? <Zap size={20} strokeWidth={1.5} />;

                    return (
                        <button
                            key={persona.id}
                            type="button"
                            onClick={() => setSelectedId(persona.id)}
                            className={`relative text-left p-5 rounded-xl border transition-all duration-150 flex flex-col items-start group ${isSelected
                                    ? 'bg-card border-foreground/50'
                                    : 'bg-card border-border hover:border-foreground/20'
                                }`}
                        >
                            <div className="flex items-center justify-between w-full mb-4">
                                <span className={`transition-colors ${isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                                    {Icon}
                                </span>
                                {isActive && (
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] font-semibold tracking-wider uppercase text-primary border border-primary/20">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                                        Active
                                    </span>
                                )}
                            </div>
                            <div className="font-semibold text-[14px] text-foreground mb-1 tracking-tight">{persona.name}</div>
                            <div className="text-[12px] text-muted-foreground leading-relaxed">{persona.tagline}</div>
                        </button>
                    );
                })}
            </div>

            {/* Detail panel */}
            <AnimatePresence mode="wait">
                {displayPersona && (
                    <motion.div
                        key={displayPersona.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-1"
                    >
                        {/* Example commands */}
                        <div className="bg-card border border-border rounded-xl p-5">
                            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-4">
                                <WandSparkles size={14} className="text-muted-foreground" />
                                Example Commands
                            </div>
                            <div className="space-y-3">
                                {displayPersona.exampleCommands.map((cmd) => (
                                    <div key={cmd} className="flex items-start gap-2.5">
                                        <ChevronRight size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
                                        <span className="font-mono text-[11px] text-muted-foreground leading-relaxed">{cmd}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Proactive triggers */}
                        <div className="bg-card border border-border rounded-xl p-5">
                            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground mb-4">
                                <Zap size={14} className="text-muted-foreground" />
                                Proactive Triggers
                            </div>
                            <div className="flex flex-col gap-2">
                                {displayPersona.proactiveTriggers.map((trigger) => (
                                    <span key={trigger} className="w-fit rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground">
                                        {trigger}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Preferred tools + switch button */}
                        <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
                            <div className="text-[13px] font-medium text-foreground mb-4">Preferred Integrations</div>
                            <div className="flex flex-wrap gap-2 flex-1">
                                {displayPersona.preferredTools.map((tool) => (
                                    <span key={tool} className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-[11px] font-medium text-foreground capitalize">
                                        {tool}
                                    </span>
                                ))}
                            </div>

                            <div className="pt-4 mt-4 border-t border-border">
                                {selectedId && selectedId !== activePersonaId ? (
                                    <button
                                        type="button"
                                        onClick={() => void handleConfirmSwitch()}
                                        disabled={isSwitching}
                                        className="w-full flex items-center justify-between rounded-lg bg-foreground text-background px-4 py-2.5 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                                    >
                                        <span>{isSwitching ? 'Switching...' : `Switch to ${displayPersona.name}`}</span>
                                        <ChevronRight size={14} />
                                    </button>
                                ) : (
                                    <div className="w-full text-center rounded-lg bg-secondary border border-border py-2.5 text-[13px] font-medium text-muted-foreground">
                                        Currently Active
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
