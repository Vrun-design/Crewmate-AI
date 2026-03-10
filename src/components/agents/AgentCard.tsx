import React from 'react';
import { AGENT_DEPT_ICONS } from './agentUi';
import type { AgentManifest } from './types';

type AgentCardProps = {
  agent: AgentManifest;
};

export function AgentCard({ agent }: AgentCardProps): React.JSX.Element {
  const DeptIcon = AGENT_DEPT_ICONS[agent.department] ?? AGENT_DEPT_ICONS.Default;

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4 flex items-start gap-3 hover:border-foreground/20 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center flex-shrink-0">
        <DeptIcon size={18} className="text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium">{agent.name}</span>
          <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{agent.department}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{agent.description}</p>
        {agent.skills.length > 0 ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {agent.skills.slice(0, 3).map((skill) => (
              <span key={skill} className="text-[10px] font-mono bg-secondary text-muted-foreground rounded px-1.5 py-0.5">
                {skill}
              </span>
            ))}
            {agent.skills.length > 3 ? <span className="text-[10px] text-muted-foreground">+{agent.skills.length - 3}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
