import React from 'react';
import { User, Zap } from 'lucide-react';
import type { AgentManifest } from './types';
import { getAgentIcon } from './agentUi';

interface AgentDrawerContentProps {
  agent: AgentManifest;
}

export function AgentDrawerContent({
  agent,
}: AgentDrawerContentProps): React.JSX.Element {
  const AgentIcon = getAgentIcon(agent);
  const capabilityItems = [...agent.skills, ...agent.capabilities.filter((capability) => !agent.skills.includes(capability))];

  return (
    <div className="mt-2 space-y-8 pb-10">
      <div className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_15px_rgba(233,84,32,0.1)]">
          <AgentIcon size={28} />
        </div>
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">{agent.name}</h3>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-foreground">
              {agent.department}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <User size={16} className="text-muted-foreground" />
          Objective
        </h4>
        <p className="rounded-xl border border-border/50 bg-secondary/50 p-4 text-[13px] leading-relaxed text-muted-foreground">
          {agent.description}
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="mt-6 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Zap size={16} className="text-muted-foreground" />
          Available Capabilities
        </h4>
        <div className="flex flex-wrap gap-2 pt-1">
          {capabilityItems.map((capability) => (
            <div
              key={capability}
              className="rounded-full border border-border/70 bg-card px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {capability}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
