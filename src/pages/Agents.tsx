import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AgentDrawerContent } from '../components/agents/AgentDrawerContent';
import { AgentNodeMap } from '../components/agents/AgentNodeMap';
import type { AgentManifest, AgentTask } from '../components/agents/types';
import { Drawer } from '../components/ui/Drawer';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { api } from '../lib/api';
import { onboardingService, type OnboardingProfile } from '../services/onboardingService';
import { SoulDrawerContent } from '../components/agents/SoulDrawerContent';
import { getUserFacingErrorMessage } from '../utils/errorHandling';
import { useLiveEvents } from '../hooks/useLiveEvents';

// Map skill-route tasks (no agentId) to a pseudo-agent by skill category prefix
const SKILL_PREFIX_TO_AGENT: Record<string, string> = {
  'browser': 'crewmate-ui-navigator-agent',
  'web': 'crewmate-research-agent',
  'google': 'crewmate-communications-agent',
  'slack': 'crewmate-communications-agent',
  'notion': 'crewmate-content-agent',
  'terminal': 'crewmate-devops-agent',
};

export function Agents(): React.JSX.Element {
  const [agents, setAgents] = useState<AgentManifest[]>([]);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentManifest | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isSoulDrawerOpen, setIsSoulDrawerOpen] = useState(false);
  const [activeAgentIds, setActiveAgentIds] = useState<Set<string>>(new Set());

  async function loadAgents(): Promise<void> {
    setIsLoadingAgents(true);
    try {
      const data = await api.get<AgentManifest[]>('/api/agents');
      setAgents(data ?? []);
      setAgentsError(null);
    } catch (loadError) {
      setAgents([]);
      setAgentsError(getUserFacingErrorMessage(loadError, 'Unable to load the crew network'));
    } finally {
      setIsLoadingAgents(false);
    }
  }

  async function loadProfile(): Promise<void> {
    try {
      setProfile(await onboardingService.getProfile());
      setProfileError(null);
    } catch (loadError) {
      setProfile(null);
      setProfileError(getUserFacingErrorMessage(loadError, 'Unable to load Crewmate identity settings'));
    }
  }

  function resolveAgentIdFromTask(task: AgentTask): string | null {
    if (task.agentId) return task.agentId;
    // For skill-routed tasks, infer the agent from the skill prefix
    const skillId = (task as AgentTask & { delegatedSkillId?: string }).delegatedSkillId ?? '';
    const prefix = skillId.split('.')[0] ?? '';
    return SKILL_PREFIX_TO_AGENT[prefix] ?? null;
  }

  async function loadActiveAgents(): Promise<void> {
    try {
      const tasks = await api.get<AgentTask[]>('/api/agents/tasks');
      const runningAgentIds = new Set(
        (tasks ?? [])
          .filter((task) => task.status === 'running' || task.status === 'queued')
          .map(resolveAgentIdFromTask)
          .filter((id): id is string => Boolean(id)),
      );
      setActiveAgentIds(runningAgentIds);
    } catch {
      // Non-fatal — node map will just show all nodes as idle
    }
  }

  useEffect(() => {
    void loadAgents();
    void loadProfile();
    void loadActiveAgents();

    // Fallback polling every 10 s (catches tasks that finish between SSE events)
    const interval = setInterval(() => void loadActiveAgents(), 10_000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Real-time: update active set immediately on SSE task events
  useLiveEvents({
    onLiveTaskUpdate: (event) => {
      const agentId = event.agentId ?? null;
      if (!agentId) return;

      if (event.status === 'running') {
        setActiveAgentIds((prev) => new Set([...prev, agentId]));
      } else {
        setActiveAgentIds((prev) => {
          const next = new Set(prev);
          next.delete(agentId);
          return next;
        });
      }
    },
  });

  const description = `Your ${agents.length} crew specialists are ready. Click any node to inspect capabilities and routing roles.`;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Crew Network" description={description} />

            {agentsError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>{agentsError}</span>
                        <Button variant="secondary" onClick={() => void loadAgents()}>Retry</Button>
                    </div>
                </div>
            ) : null}

            {profileError ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>{profileError}</span>
                        <Button variant="secondary" onClick={() => void loadProfile()}>Retry identity load</Button>
                    </div>
                </div>
            ) : null}

            <div className="mt-4">
                {isLoadingAgents ? (
                    <div className="text-center py-16 text-muted-foreground w-full border border-border rounded-xl bg-card">
                        <Loader2 size={24} className="mx-auto mb-3 animate-spin opacity-40" />
                        <p className="text-sm">Loading the crew network...</p>
                    </div>
                ) : agents.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground w-full border border-border rounded-xl bg-card">
                        <p className="text-sm">No crew specialists are available right now.</p>
                    </div>
                ) : (
                    <AgentNodeMap
                        agents={agents}
                        activeAgentIds={activeAgentIds}
                        onNodeClick={setSelectedAgent}
                        selectedAgentId={selectedAgent?.id}
                        coreAgentName={profile?.agentName ? `${profile.agentName} (Crew Captain)` : 'Crew Captain'}
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
                        isActive={activeAgentIds.has(selectedAgent.id)}
                    />
                ) : null}
            </Drawer>

            {/* Drawer Overlay for Orchestrator Soul Info */}
            <Drawer
                isOpen={isSoulDrawerOpen}
                onClose={() => setIsSoulDrawerOpen(false)}
                title="Crew Captain"
            >
                <SoulDrawerContent
                    key={profile ? 'loaded' : 'loading'}
                    profile={profile}
                    onSaved={(newProfile) => setProfile(newProfile)}
                />
            </Drawer>
    </div>
  );
}
