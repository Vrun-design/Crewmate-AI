import React from 'react';
import { Loader2 } from 'lucide-react';
import { AgentStepRow } from './AgentStepRow';
import { getAgentTaskStatusMeta } from './agentUi';
import type { AgentTask } from './types';
import { cn } from '../../utils/cn';

type AgentTaskTraceProps = {
  task: AgentTask;
  className?: string;
};

export function AgentTaskTrace({ task, className }: AgentTaskTraceProps): React.JSX.Element | null {
  const steps = task.steps ?? [];
  const shouldRenderTrace = task.status === 'running' || task.status === 'queued' || steps.length > 0;

  if (!shouldRenderTrace) {
    return null;
  }

  const statusMeta = getAgentTaskStatusMeta(task.status);

  return (
    <div className={cn('space-y-0', className)}>
      {steps.map((step, index) => (
        <React.Fragment key={`${step.taskId}-${step.stepIndex}`}>
          <AgentStepRow step={step} isLast={index === steps.length - 1} />
        </React.Fragment>
      ))}

      {(task.status === 'running' || task.status === 'queued') && steps.length === 0 ? (
        <div className={cn('flex items-center gap-3 pl-0.5 py-3')}>
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
            <Loader2 size={13} className={cn('animate-spin', task.status === 'queued' ? 'text-muted-foreground' : 'text-blue-400')} />
          </div>
          <p className="text-xs text-muted-foreground animate-pulse">
            {task.status === 'queued' ? 'Queued — waiting to start...' : `${statusMeta.label}. Waiting for first live step...`}
          </p>
        </div>
      ) : task.status === 'running' && steps.length > 0 ? (
        <div className="flex items-center gap-3 pl-0.5 pt-1">
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
            <Loader2 size={13} className="animate-spin text-blue-400" />
          </div>
          <p className="text-xs text-muted-foreground animate-pulse">Working...</p>
        </div>
      ) : null}
    </div>
  );
}
