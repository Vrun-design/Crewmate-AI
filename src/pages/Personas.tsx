import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Briefcase, Check, ChevronRight, Code2, Megaphone, Palette, Rocket, Sparkles, Zap } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { usePersonas } from '../hooks/usePersonas';

const PERSONA_ICONS: Record<string, React.ReactNode> = {
    developer: <Code2 size={24} strokeWidth={1.5} />,
    marketer: <Megaphone size={24} strokeWidth={1.5} />,
    founder: <Rocket size={24} strokeWidth={1.5} />,
    sales: <Briefcase size={24} strokeWidth={1.5} />,
    designer: <Palette size={24} strokeWidth={1.5} />,
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
            <div className="space-y-6 max-w-5xl mx-auto">
                <PageHeader title="Personas" description="Loading your agent configurations..." />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-40 rounded-xl bg-muted/20 animate-pulse border border-border" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-12">
            <PageHeader
                title="Personas"
                description="Configure Crewmate's core expertise, proactive behaviors, and integration priorities."
            />

            {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* Persona grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {personas.map((persona) => {
                    const isActive = persona.id === activePersonaId;
                    const isSelected = persona.id === displayId;
                    const Icon = PERSONA_ICONS[persona.id] ?? <Zap size={24} strokeWidth={1.5} />;

                    return (
                        <button
                            key={persona.id}
                            type="button"
                            onClick={() => setSelectedId(persona.id)}
                            className={`relative text-left p-5 rounded-xl border transition-all duration-200 group flex flex-col items-start ${isSelected
                                ? 'bg-card border-foreground ring-1 ring-foreground shadow-sm'
                                : 'bg-card/50 border-border hover:border-muted-foreground/50 hover:bg-card'
                                }`}
                        >
                            <div className="flex items-center justify-between w-full mb-4 text-foreground/80">
                                {Icon}
                                {isActive && (
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-[10px] font-semibold tracking-wider uppercase text-primary border border-primary/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                        Active
                                    </span>
                                )}
                            </div>
                            <div className="font-medium text-foreground text-sm mb-1">{persona.name}</div>
                            <div className="text-[13px] text-muted-foreground leading-snug">{persona.tagline}</div>
                        </button>
                    );
                })}
            </div>

            {/* Detail panel + confirm button */}
            <AnimatePresence>
                {displayPersona && (
                    <motion.div
                        key={displayPersona.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2"
                    >
                        {/* Example commands */}
                        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Sparkles size={14} className="text-muted-foreground" />
                                Example Commands
                            </div>
                            <div className="space-y-3">
                                {displayPersona.exampleCommands.map((cmd) => (
                                    <div key={cmd} className="flex items-start gap-3">
                                        <ChevronRight size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                                        <span className="font-mono text-[12px] text-muted-foreground leading-relaxed">{cmd}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Proactive triggers */}
                        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                            <div className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Zap size={14} className="text-muted-foreground" />
                                Proactive Triggers
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {displayPersona.proactiveTriggers.map((trigger) => (
                                    <span key={trigger} className="rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                        {trigger}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Preferred tools + action */}
                        <div className="bg-card border border-border rounded-xl p-5 flex flex-col space-y-4">
                            <div className="text-sm font-medium text-foreground">Preferred Integrations</div>
                            <div className="flex flex-wrap gap-2 flex-1">
                                {displayPersona.preferredTools.map((tool) => (
                                    <span key={tool} className="rounded-md border border-border bg-muted/20 px-3 py-1.5 text-xs font-medium text-foreground capitalize">
                                        {tool}
                                    </span>
                                ))}
                            </div>

                            <div className="pt-4 border-t border-border mt-auto">
                                {selectedId && selectedId !== activePersonaId ? (
                                    <button
                                        type="button"
                                        onClick={() => void handleConfirmSwitch()}
                                        disabled={isSwitching}
                                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-foreground text-background py-2.5 text-[13px] font-medium transition-colors hover:bg-foreground/90 disabled:opacity-50"
                                    >
                                        {isSwitching ? (
                                            'Switching...'
                                        ) : (
                                            <>
                                                Switch to {displayPersona.name}
                                                <ChevronRight size={14} />
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <div className="w-full flex items-center justify-center gap-2 rounded-lg bg-muted/50 border border-border/50 py-2.5 text-[13px] font-medium text-muted-foreground">
                                        <Check size={14} />
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
