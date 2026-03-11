import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AgentDrawerContent } from '../components/agents/AgentDrawerContent';
import { AgentNodeMap } from '../components/agents/AgentNodeMap';
import type { AgentManifest } from '../components/agents/types';
import { Drawer } from '../components/ui/Drawer';
import { PageHeader } from '../components/ui/PageHeader';
import { api } from '../lib/api';
import { onboardingService, type OnboardingProfile } from '../services/onboardingService';
import { SoulDrawerContent } from '../components/agents/SoulDrawerContent';

export function Agents(): React.JSX.Element {
    const [agents, setAgents] = useState<AgentManifest[]>([]);
    const [agentsError, setAgentsError] = useState<string | null>(null);
    const [selectedAgent, setSelectedAgent] = useState<AgentManifest | null>(null);
    const [profile, setProfile] = useState<OnboardingProfile | null>(null);
    const [isSoulDrawerOpen, setIsSoulDrawerOpen] = useState(false);

    useEffect(() => {
        void api.get<AgentManifest[]>('/api/agents')
            .then((data) => {
                setAgents(data ?? []);
                setAgentsError(null);
            })
            .catch((loadError) => {
                setAgents([]);
                setAgentsError(loadError instanceof Error ? loadError.message : 'Unable to load crew agents');
            });

        void onboardingService.getProfile().then(setProfile);
    }, []);

    const description = `Your ${agents.length} specialized crew agents are ready. Click any node in the topology map to inspect their capabilities.`;

    return (
        <div className="space-y-6 pb-10">
            <PageHeader title="Crew Network" description={description} />

            {agentsError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {agentsError}
                </div>
            ) : null}

            <div className="mt-4">
                {agents.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground w-full border border-border rounded-xl bg-card">
                        <Loader2 size={24} className="mx-auto mb-3 animate-spin opacity-40" />
                        <p className="text-sm">Initializing geometric node mapping...</p>
                    </div>
                ) : (
                    <AgentNodeMap
                        agents={agents}
                        activeAgentIds={new Set()}
                        onNodeClick={setSelectedAgent}
                        selectedAgentId={selectedAgent?.id}
                        coreAgentName={profile?.agentName ? `${profile.agentName} (Orchestrator)` : 'Core Orchestrator'}
                        onCoreNodeClick={() => setIsSoulDrawerOpen(true)}
                    />
                )}
            </div>

            {/* Drawer Overlay for Selected Agent Details */}
            <Drawer
                isOpen={selectedAgent !== null}
                onClose={() => setSelectedAgent(null)}
                title={selectedAgent?.name ?? 'Agent Details'}
            >
                {selectedAgent ? (
                    <AgentDrawerContent
                        agent={selectedAgent}
                    />
                ) : null}
            </Drawer>

            {/* Drawer Overlay for Orchestrator Soul Info */}
            <Drawer
                isOpen={isSoulDrawerOpen}
                onClose={() => setIsSoulDrawerOpen(false)}
                title="Orchestrator Identity"
            >
                <SoulDrawerContent 
                    profile={profile} 
                    onSaved={(newProfile) => setProfile(newProfile)} 
                />
            </Drawer>
        </div>
    );
}
