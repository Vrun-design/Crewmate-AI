import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, XCircle } from 'lucide-react';
import { AgentStepRow } from './AgentStepRow';
import type { AgentTask } from './types';

type AgentTaskCardProps = {
  task: AgentTask;
  isActive: boolean;
};

export function AgentTaskCard({ task, isActive }: AgentTaskCardProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      setExpanded(true);
    }
  }, [isActive]);

  const steps = task.steps ?? [];
  const duration = task.completedAt
    ? Math.round((new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime()) / 1000)
    : null;
  const agentShort = task.agentId.replace('crewmate-', '').replace('-agent', '');

  function renderStatusIcon(): React.JSX.Element {
    if (task.status === 'running') {
      return <Loader2 size={14} className="text-blue-400 animate-spin" />;
    }

    if (task.status === 'completed') {
      return <CheckCircle2 size={14} className="text-emerald-400" />;
    }

    if (task.status === 'failed') {
      return <XCircle size={14} className="text-red-400" />;
    }

    return <Clock size={14} className="text-muted-foreground" />;
  }

  function getStatusContainerClass(): string {
    if (task.status === 'running') {
      return 'border-blue-500/40 bg-blue-500/10';
    }

    if (task.status === 'completed') {
      return 'border-emerald-500/30 bg-emerald-500/10';
    }

    if (task.status === 'failed') {
      return 'border-red-500/30 bg-red-500/10';
    }

    return 'border-border bg-secondary';
  }

  function getCardClass(): string {
    if (task.status === 'running') {
      return 'border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.08)]';
    }

    if (task.status === 'completed') {
      return 'border-emerald-500/20';
    }

    if (task.status === 'failed') {
      return 'border-red-500/20';
    }

    return 'border-border';
  }

  const renderedResult =
    typeof task.result === 'string' ? task.result.slice(0, 800) : JSON.stringify(task.result, null, 2).slice(0, 800);

  return (
    <div className={`rounded-xl border bg-card/50 overflow-hidden transition-all duration-300 ${getCardClass()}`}>
      <button
        type="button"
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center text-sm ${getStatusContainerClass()}`}>
          {renderStatusIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{agentShort}</span>
            {duration !== null ? <span className="text-[10px] text-muted-foreground">· {duration}s</span> : null}
            {steps.length > 0 ? <span className="text-[10px] text-muted-foreground">· {steps.length} steps</span> : null}
          </div>
          <p className="text-sm font-medium text-foreground truncate">{task.intent}</p>
          {task.status === 'running' && steps.length > 0 ? (
            <p className="text-xs text-blue-400 mt-0.5 animate-pulse">{steps[steps.length - 1]?.label ?? 'Working...'}</p>
          ) : null}
        </div>

        {steps.length > 0 ? <div className="flex-shrink-0 text-muted-foreground">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</div> : null}
      </button>

      {expanded && steps.length > 0 ? (
        <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-0">
          {steps.map((step, index) => (
            <React.Fragment key={`${step.taskId}-${step.stepIndex}`}>
              <AgentStepRow step={step} isLast={index === steps.length - 1} />
            </React.Fragment>
          ))}
          {task.status === 'running' ? (
            <div className="flex gap-3 items-center pl-0.5 pt-1">
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <Loader2 size={13} className="text-blue-400 animate-spin" />
              </div>
              <p className="text-xs text-muted-foreground animate-pulse">Working...</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {expanded && task.status === 'completed' && task.result ? (
        <div className="px-4 pb-4 border-t border-border/50 pt-3">
          <pre className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">
            {renderedResult}
            {JSON.stringify(task.result ?? '').length > 800 ? '\n[...truncated]' : ''}
          </pre>
        </div>
      ) : null}

      {expanded && task.status === 'failed' && task.error ? (
        <div className="px-4 pb-4 border-t border-red-500/20 pt-3">
          <p className="text-xs text-red-400">{task.error}</p>
        </div>
      ) : null}
    </div>
  );
}
