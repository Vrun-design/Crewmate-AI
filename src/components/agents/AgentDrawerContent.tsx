import React, { useState } from 'react';
import { User, Zap, PlayCircle, Loader2, CheckCircle2 } from 'lucide-react';
import type { AgentManifest } from './types';
import { getAgentIcon } from './agentUi';
import { api } from '../../lib/api';

interface AgentDrawerContentProps {
  agent: AgentManifest;
  isActive?: boolean;
}

function getCapabilityItems(agent: AgentManifest): string[] {
  return [...agent.skills, ...agent.capabilities.filter((capability) => !agent.skills.includes(capability))];
}

export function AgentDrawerContent({
  agent,
  isActive = false,
}: AgentDrawerContentProps): React.JSX.Element {
  const AgentIcon = getAgentIcon(agent);
  const capabilityItems = getCapabilityItems(agent);

  const [tryPrompt, setTryPrompt] = useState('');
  const [tryState, setTryState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [tryError, setTryError] = useState<string | null>(null);

  async function handleTryAgent(): Promise<void> {
    if (!tryPrompt.trim() || tryState === 'sending') {
      return;
    }

    setTryState('sending');
    setTryError(null);

    try {
      await api.post('/api/orchestrate', { intent: tryPrompt.trim() });
      setTryState('sent');
      setTryPrompt('');
      setTimeout(() => setTryState('idle'), 3000);
    } catch (err) {
      setTryState('error');
      setTryError(err instanceof Error ? err.message : 'Failed to dispatch task');
      setTimeout(() => setTryState('idle'), 4000);
    }
  }

  return (
    <div className="mt-2 space-y-8 pb-10">
      <div className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-[0_0_15px_rgba(233,84,32,0.1)]">
            <AgentIcon size={28} />
          </div>
          {isActive && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold tracking-tight text-foreground">{agent.name}</h3>
            {isActive && (
              <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full">Running</span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-foreground">
              {agent.department}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-1/3 shrink-0">
          <User size={14} className="opacity-70" />
          Objective
        </h4>
        <p className="text-sm text-foreground/90 font-medium leading-relaxed">
          {agent.description}
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="mt-6 flex items-center gap-2 text-sm font-medium text-muted-foreground w-1/3 shrink-0">
          <Zap size={14} className="opacity-70" />
          Available Capabilities
        </h4>
        <div className="flex flex-wrap gap-2 pt-1">
          {capabilityItems.map((capability) => (
            <div
              key={capability}
              className="rounded-full border border-border/70 bg-card/50 px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors hover:border-primary/40 hover:text-foreground"
            >
              {capability}
            </div>
          ))}
        </div>
      </div>

      {/* Try This Agent */}
      <div className="space-y-3 border-t border-border pt-6">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PlayCircle size={16} className="text-muted-foreground" />
          Try This Agent
        </h4>
        <p className="text-xs text-muted-foreground">
          Dispatch a task directly to the orchestrator — it will route to {agent.name}.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={tryPrompt}
            onChange={(event) => setTryPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleTryAgent();
              }
            }}
            placeholder={`e.g. "Write a blog post about AI trends"`}
            disabled={tryState === 'sending' || tryState === 'sent'}
            className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleTryAgent()}
            disabled={!tryPrompt.trim() || tryState !== 'idle'}
            className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
          >
            {tryState === 'sending'
              ? <Loader2 size={14} className="animate-spin" />
              : tryState === 'sent'
                ? <CheckCircle2 size={14} />
                : 'Run'}
          </button>
        </div>
        {tryState === 'sent' && (
          <p className="text-xs text-emerald-500">Task dispatched — check the Tasks panel to track progress.</p>
        )}
        {tryState === 'error' && tryError && (
          <p className="text-xs text-destructive">{tryError}</p>
        )}
      </div>
    </div>
  );
}
