import React, { useMemo } from 'react';
import { getAgentIcon } from './agentUi';
import type { AgentManifest } from './types';
import { Tooltip } from '../ui/Tooltip';

interface AgentNodeMapProps {
    agents: AgentManifest[];
    activeAgentIds: Set<string>;
    onNodeClick: (agent: AgentManifest) => void;
    selectedAgentId?: string | null;
    coreAgentName?: string;
    onCoreNodeClick?: () => void;
}

export function AgentNodeMap({ agents, activeAgentIds, onNodeClick, selectedAgentId, coreAgentName = 'Crew Captain', onCoreNodeClick }: AgentNodeMapProps): React.JSX.Element {

    // Mathematics to distribute agents in a ring around the center Core
    const radius = 140;
    const centerX = 200;
    const centerY = 200;

    const nodes = useMemo(() => {
        return agents.map((agent, index) => {
            // Calculate angle for current node
            const angle = (index / agents.length) * (2 * Math.PI) - (Math.PI / 2);

            // Calculate X and Y coordinates on the circle
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            const isActive = activeAgentIds.has(agent.id);
            const isSelected = selectedAgentId === agent.id;

            // Create a gorgeous sweeping curve rather than a straight line
            const midX = (centerX + x) / 2;
            const midY = (centerY + y) / 2;
            const offsetDist = 40;
            const cpX = midX - offsetDist * Math.sin(angle);
            const cpY = midY + offsetDist * Math.cos(angle);

            return {
                agent,
                x,
                y,
                index,
                isActive,
                isSelected,
                pathId: `path-${agent.id}`,
                d: `M ${centerX} ${centerY} Q ${cpX} ${cpY} ${x} ${y}`,
            };
        });
    }, [agents, activeAgentIds, selectedAgentId, centerX, centerY, radius]);

    return (
        <div className="w-full h-[400px] relative group/map flex items-center justify-center">

            {/* Background Layer with Rounded Corners & Clipping */}
            <div className="absolute inset-0 rounded-2xl bg-card border border-border shadow-soft overflow-hidden pointer-events-none z-0">
                {/* Mosaic Grid Background */}
                <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] text-foreground"
                    style={{
                        backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
                        backgroundSize: '32px 32px',
                        backgroundPosition: 'center center',
                    }}
                />
            </div>

            {/* SVG Link & Particle Layer */}
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-0"
                viewBox="0 0 400 400"
                preserveAspectRatio="xMidYMid meet"
            >
                <defs>
                    <filter id="glowBlur" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <filter id="radarBlur">
                        <feGaussianBlur stdDeviation="8" />
                    </filter>
                </defs>

                {/* Central Radar Sweeps */}
                <circle cx={centerX} cy={centerY} r="30" fill="none" stroke="var(--primary)" strokeWidth="1" opacity="0" className="animate-[radar_3s_linear_infinite]" filter="url(#radarBlur)" />
                <circle cx={centerX} cy={centerY} r="30" fill="none" stroke="var(--primary)" strokeWidth="0.5" opacity="0" className="animate-[radar_3s_linear_infinite]" style={{ animationDelay: '1.5s' }} filter="url(#radarBlur)" />

                {/* Connection Paths & Particles */}
                {nodes.map(node => (
                    <g key={node.pathId}>
                        {/* Base passive structural line */}
                        <path
                            d={node.d}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="text-muted opacity-20 transition-all duration-700"
                        />

                        {/* Active glowing pipeline */}
                        <path
                            d={node.d}
                            fill="none"
                            stroke="var(--primary)"
                            strokeWidth={node.isActive ? "2" : "0"}
                            className="transition-all duration-700"
                            style={{
                                opacity: node.isActive ? 0.4 : 0,
                                strokeDasharray: '4 4',
                                filter: node.isActive ? 'url(#glowBlur)' : 'none',
                                animation: node.isActive ? 'dash 1.5s linear infinite' : 'none',
                            }}
                        />

                        {/* Physical Data Transfer Particle (animateMotion) */}
                        {node.isActive && (
                            <circle r="3" fill="var(--primary)" filter="url(#glowBlur)">
                                <animateMotion
                                    dur="1.5s"
                                    repeatCount="indefinite"
                                    path={node.d}
                                    calcMode="spline"
                                    keySplines="0.4 0 0.2 1"
                                    keyTimes="0;1"
                                />
                            </circle>
                        )}
                    </g>
                ))}
            </svg>

            {/* Required CSS Keyframes */}
            <style>{`
                @keyframes dash {
                    to { stroke-dashoffset: -16; }
                }
                @keyframes radar {
                    0% { r: 30; opacity: 0.8; stroke-width: 2; }
                    100% { r: 180; opacity: 0; stroke-width: 0; }
                }
                @keyframes organic-float {
                    0% { transform: translateY(0px) scale(var(--tw-scale-x)); }
                    50% { transform: translateY(-8px) scale(var(--tw-scale-x)); }
                    100% { transform: translateY(0px) scale(var(--tw-scale-x)); }
                }
            `}</style>

            {/* Centered Core Orchestrator Node */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto">
                <Tooltip content={
                    <div className="flex flex-col gap-1 items-center pb-0.5">
                        <span className="font-mono text-xs">{coreAgentName}</span>
                        {onCoreNodeClick && <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Click to view Soul</span>}
                    </div>
                }>
                    <div 
                        onClick={onCoreNodeClick}
                        className="w-16 h-16 rounded-2xl bg-primary shadow-[0_0_30px_rgba(233,84,32,0.5)] border border-white/20 flex items-center justify-center relative select-none cursor-pointer hover:scale-105 transition-transform"
                    >
                        <div className="absolute inset-0 rounded-2xl border-2 border-white/30 animate-pulse opacity-40 shadow-[inset_0_0_10px_rgba(255,255,255,0.4)]" />
                        <img
                            src="/Crewmate_logo.svg"
                            alt={coreAgentName}
                            className="h-8 w-8 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                        />
                    </div>
                </Tooltip>
            </div>

            {/* Distributed Agent Nodes */}
            <div className="absolute inset-0 pointer-events-none">
                {nodes.map(node => {
                    const AgentIcon = getAgentIcon(node.agent);

                    return (
                        <div
                            key={node.agent.id}
                            style={{
                                left: `calc(50% - 24px + ${node.x - centerX}px)`,
                                top: `calc(50% - 24px + ${node.y - centerY}px)`,
                                animation: `organic-float 4s ease-in-out infinite`,
                                animationDelay: `${node.index * -0.4}s`
                            }}
                            className="absolute z-10 hover:z-50 pointer-events-auto"
                        >
                            <Tooltip content={
                                <div className="flex flex-col gap-1 items-center pb-0.5">
                                    <span className="font-semibold text-[13px]">{node.agent.name}</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Click to inspect</span>
                                </div>
                            }>
                                <div
                                    className={`
                                        w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300
                                        backdrop-blur-md border 
                                        ${node.isActive
                                            ? 'bg-primary/20 border-primary shadow-[0_0_25px_rgba(233,84,32,0.5)] scale-110'
                                            : 'bg-card/90 border-border hover:border-muted-foreground hover:bg-secondary shadow-lg'
                                        }
                                        ${node.isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                                    `}
                                    onClick={() => onNodeClick(node.agent)}
                                >
                                    {node.isActive && (
                                        <div className="absolute inset-0 rounded-full border border-primary animate-ping opacity-30" />
                                    )}
                                    <AgentIcon size={18} className={`transition-colors duration-300 ${node.isActive ? 'text-primary drop-shadow-[0_0_5px_rgba(233,84,32,0.8)]' : 'text-muted-foreground group-hover/map:text-foreground'}`} />
                                </div>
                            </Tooltip>
                        </div>
                    );
                })}
            </div>

            {/* Status Legend over Canvas */}
            <div className="absolute bottom-6 right-6 flex items-center gap-6 text-[10px] uppercase font-mono tracking-widest bg-card/60 backdrop-blur-md px-5 py-2.5 rounded-xl border border-border shadow-soft z-20">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground shadow-[0_0_5px_rgba(150,150,150,0.3)]" />
                    <span className="text-muted-foreground font-semibold">{agents.length - activeAgentIds.size} Idle</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(233,84,32,0.8)] animate-pulse" />
                    <span className="text-foreground font-semibold text-primary">{activeAgentIds.size} Active</span>
                </div>
            </div>

        </div>
    );
}
