import React from 'react';
import { Activity, Bot, Clock3, Loader2, TimerReset, WandSparkles } from 'lucide-react';
import { AgentTaskCard } from './AgentTaskCard';
import { getAgentIcon, getAgentTaskAgentLabel, getAgentTaskDurationSeconds, getAgentTaskStatusMeta } from './agentUi';
import type { AgentTask } from './types';
import { Badge } from '../ui/Badge';
import { Card, CardContent } from '../ui/Card';
import { cn } from '../../utils/cn';

type AgentTaskDrawerContentProps = {
  task: AgentTask;
};

type SummaryMetricProps = {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
};

function SummaryMetric({ icon: Icon, label, value }: SummaryMetricProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <Icon size={14} className="text-muted-foreground" />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function formatTaskTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function AgentTaskDrawerContent({ task }: AgentTaskDrawerContentProps): React.JSX.Element {
  const steps = task.steps ?? [];
  const latestStep = steps[steps.length - 1];
  const duration = getAgentTaskDurationSeconds(task);
  const agentLabel = getAgentTaskAgentLabel(task.agentId);
  const statusMeta = getAgentTaskStatusMeta(task.status);
  const AgentIcon = getAgentIcon({ id: task.agentId, department: 'Default' });
  const hasTraceContent = steps.length > 0 || task.status === 'running' || Boolean(task.result) || Boolean(task.error);

  return (
    <div className="space-y-6 pb-4">
      <Card className={cn('overflow-visible border-border/60 shadow-soft', task.status === 'running' && 'shadow-[0_12px_40px_rgba(59,130,246,0.08)]')}>
        <CardContent className="space-y-5 p-5">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border',
                task.status === 'running'
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                  : 'border-primary/20 bg-primary/10 text-primary',
              )}
            >
              {task.status === 'running' ? <Loader2 size={22} className="animate-spin" /> : <AgentIcon size={22} />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[11px] text-muted-foreground">{task.id}</span>
                <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
                {task.status === 'running' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-blue-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Live stream
                  </span>
                ) : null}
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Agent Task</p>
                <h3 className="text-xl font-semibold text-foreground">{task.intent}</h3>
                <p className="text-sm text-muted-foreground">{agentLabel} agent execution</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SummaryMetric icon={Bot} label="Agent" value={agentLabel} />
            <SummaryMetric icon={Activity} label="Steps" value={`${steps.length} streamed`} />
            <SummaryMetric icon={Clock3} label="Started" value={formatTaskTimestamp(task.createdAt)} />
            <SummaryMetric icon={TimerReset} label="Duration" value={duration !== null ? `${duration}s` : 'In progress'} />
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <WandSparkles size={14} className="text-muted-foreground" />
              Latest event
            </div>
            {latestStep ? (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-medium text-foreground">{latestStep.label}</p>
                <p className="text-xs text-muted-foreground">
                  {latestStep.detail?.trim() || (task.status === 'running' ? 'Live execution is still streaming.' : 'Execution finished without extra detail on the last step.')}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {task.status === 'queued' ? 'Task is queued. The first streamed step will appear once execution begins.' : 'Waiting for the first streamed step.'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Execution Trace</p>
          <p className="text-sm text-muted-foreground">
            {steps.length > 0
              ? `${steps.length} live event${steps.length === 1 ? '' : 's'} received for this task.`
              : 'This stream is connected, but no execution steps have arrived yet.'}
          </p>
        </div>

        {hasTraceContent ? (
          <AgentTaskCard task={task} isActive layout="drawer" />
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-sm text-muted-foreground">
            Stream connected. Waiting for execution output.
          </div>
        )}
      </div>
    </div>
  );
}
