import React, { useState } from 'react';
import { Activity, AlertTriangle, Bot, Clock3, ExternalLink, Loader2, RefreshCw, WandSparkles } from 'lucide-react';
import { AgentTaskTrace } from './AgentTaskTrace';
import { getAgentIcon, getAgentTaskAgentLabel, getAgentTaskDurationSeconds, getAgentTaskStatusMeta, getSkillLabel } from './agentUi';
import type { AgentTask } from './types';
import type { TaskRun } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { PropertyRow } from '../ui/PropertyRow';
import { cn } from '../../utils/cn';

type AgentTaskDrawerContentProps = {
  task: AgentTask;
  onCancel?: () => void;
  isCancelling?: boolean;
  onRetry?: () => void;
  isRetrying?: boolean;
  runHistory?: TaskRun[];
};

type DrawerTab = 'overview' | 'activity';

function formatTaskTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getArtifactLink(result: unknown): { label: string; url: string; imageUrl?: string | null } | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const record = result as Record<string, unknown>;
  const output = (record.output && typeof record.output === 'object' && !Array.isArray(record.output))
    ? record.output as Record<string, unknown>
    : record;
  const screenshot = output.screenshot && typeof output.screenshot === 'object' && !Array.isArray(output.screenshot)
    ? output.screenshot as Record<string, unknown>
    : null;
  const url = typeof output.url === 'string'
    ? output.url
    : typeof output.publicUrl === 'string'
      ? output.publicUrl
      : typeof screenshot?.publicUrl === 'string'
        ? screenshot.publicUrl
        : null;
  const title = typeof output.title === 'string' ? output.title : typeof output.name === 'string' ? output.name : null;

  if (!url) {
    return null;
  }

  return {
    label: title ?? (typeof screenshot?.title === 'string' ? screenshot.title : 'Open document'),
    url,
    imageUrl: typeof output.publicUrl === 'string'
      ? output.publicUrl
      : typeof screenshot?.publicUrl === 'string'
        ? screenshot.publicUrl
        : null,
  };
}

function getRunHistoryBadgeVariant(status: TaskRun['status']): 'success' | 'danger' | 'default' {
  if (status === 'completed') return 'success';
  if (status === 'failed') return 'danger';
  return 'default';
}

function getOriginLabel(originType?: AgentTask['originType']): string {
  return originType === 'live_session' ? 'Live session (Delegated)' : 'Manual command';
}

function getCurrentStatusDetail(task: AgentTask, latestStep?: AgentTask['steps'][number]): string | null {
  if (task.status !== 'running' || !latestStep) {
    return null;
  }

  return latestStep.detail ?? null;
}

export function AgentTaskDrawerContent({ task, onCancel, isCancelling = false, onRetry, isRetrying = false, runHistory = [] }: AgentTaskDrawerContentProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<DrawerTab>('overview');

  const steps = task.steps ?? [];
  const latestStep = steps[steps.length - 1];
  const duration = getAgentTaskDurationSeconds(task);
  const agentLabel = getAgentTaskAgentLabel(task.agentId);
  const skillLabel = getSkillLabel(task.delegatedSkillId);
  const statusMeta = getAgentTaskStatusMeta(task.status);
  const AgentIcon = getAgentIcon({ id: task.agentId, department: 'Default' });
  const artifactLink = getArtifactLink(task.result);
  const executionTitle = task.routeType === 'delegated_skill' ? 'Background Skill' : 'Agent Workflow';
  const metricLabel = task.routeType === 'delegated_skill' ? 'Skill' : 'Agent';
  const metricValue = task.routeType === 'delegated_skill' ? skillLabel : agentLabel;
  const currentStatusDetail = getCurrentStatusDetail(task, latestStep);

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="px-1 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px]',
                task.status === 'running'
                  ? 'bg-blue-500/10 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20'
                  : 'bg-primary/10 text-primary ring-1 ring-primary/10',
              )}
            >
              {task.status === 'running' ? <Loader2 size={24} className="animate-spin" /> : <AgentIcon size={24} />}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant={statusMeta.badgeVariant} className="px-2 py-0.5 rounded-sm">{statusMeta.label}</Badge>
                {task.status === 'running' && (
                  <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Live
                  </span>
                )}
                <span className="text-[11px] font-mono text-muted-foreground/50 ml-1">#{task.id.slice(0, 8)}</span>
              </div>
              <h3 className="text-lg leading-tight font-semibold text-foreground mt-1">{task.intent}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{executionTitle} • {metricValue}</p>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 shrink-0">
            {(task.status === 'queued' || task.status === 'running') && onCancel ? (
              <Button variant="secondary" size="sm" onClick={onCancel} disabled={isCancelling} className="h-8 text-xs font-medium hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30">
                {isCancelling ? 'Cancelling...' : 'Cancel Task'}
              </Button>
            ) : null}
            {task.status === 'failed' && onRetry ? (
              <Button variant="secondary" size="sm" onClick={onRetry} disabled={isRetrying} className="h-8 text-xs font-medium">
                <RefreshCw size={13} className={cn("mr-1.5", isRetrying && "animate-spin")} />
                {isRetrying ? 'Retrying...' : 'Retry'}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border/40 px-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "pb-3 text-sm font-medium transition-colors relative",
            activeTab === 'overview' ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Overview
          {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={cn(
            "pb-3 text-sm font-medium transition-colors relative flex items-center gap-1.5",
            activeTab === 'activity' ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Activity Trace
          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">{steps.length}</span>
          {activeTab === 'activity' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t-full" />}
        </button>
      </div>

      <div className="px-1 flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-6 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Soft Alerts */}
            {task.status === 'failed' && task.error && (
              <div className="rounded-xl bg-destructive/5 px-4 py-3 border border-destructive/10">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-1">
                  <AlertTriangle size={16} />
                  Execution Failed
                </div>
                <p className="text-sm text-destructive/80 font-mono leading-relaxed break-words">{task.error}</p>
              </div>
            )}
            
            {task.status === 'cancelled' && (
              <div className="rounded-xl bg-muted/50 px-4 py-3 border border-border/40 text-sm text-muted-foreground">
                Task was cancelled by the user. Background execution was aborted.
              </div>
            )}

            {/* Clean Property List */}
            <div className="px-2">
              <PropertyRow label={metricLabel} value={metricValue} icon={Bot} />
              <PropertyRow label="Started" value={formatTaskTimestamp(task.createdAt)} icon={Clock3} />
              <PropertyRow label="Duration" value={duration !== null ? `${duration}s` : 'Processing...'} icon={Activity} />
              <PropertyRow label="Origin" value={getOriginLabel(task.originType)} />
              
              {currentStatusDetail ? (
                <div className="mt-4 p-4 rounded-xl bg-muted/30 border border-border/40">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    <WandSparkles size={14} />
                    Current Status
                  </div>
                  <p className="text-sm font-medium text-foreground">{latestStep?.label}</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{currentStatusDetail}</p>
                </div>
              ) : null}
            </div>

            {artifactLink && (
              <div className="mt-6 rounded-2xl overflow-hidden border border-border/50 bg-card shadow-sm hover:shadow-md transition-shadow group">
                {artifactLink.imageUrl && (
                  <div className="h-48 w-full bg-muted/20 border-b border-border/20 overflow-hidden relative">
                    <img src={artifactLink.imageUrl} alt={artifactLink.label} className="w-full h-full object-cover object-top" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                  </div>
                )}
                <div className="p-4 flex items-center justify-between">
                  <div className="flex flex-col min-w-0 pr-4">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Generated Result</span>
                    <span className="text-sm font-medium text-foreground truncate">{artifactLink.label}</span>
                  </div>
                  <Button
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => window.open(artifactLink.url, '_blank', 'noopener,noreferrer')}
                  >
                    Open <ExternalLink size={14} className="ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {runHistory.length > 1 && (
              <div className="mt-8">
                <h4 className="text-sm font-medium text-foreground mb-3 px-2">Attempt History</h4>
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  {runHistory.map((run, index) => (
                    <div key={run.id} className={cn('flex items-center justify-between px-4 py-3 text-sm', index !== 0 && 'border-t border-border/40')}>
                      <span className="text-muted-foreground">{new Date(run.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      <Badge variant={getRunHistoryBadgeVariant(run.status)} className="px-2 py-0.5 rounded-sm bg-transparent border-current">
                        {run.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4 pb-6 animate-in fade-in slide-in-from-right-2 duration-200">
            {steps.length > 0 ? (
              <div className="rounded-xl border border-border/60 bg-card/30 p-4">
                <AgentTaskTrace task={task} />

                {(task.status === 'failed' || task.status === 'cancelled') && task.error ? (
                  <div className={cn(
                    'mt-4 rounded-xl p-4',
                    task.status === 'cancelled'
                      ? 'border border-amber-500/20 bg-amber-500/5'
                      : 'border border-red-500/20 bg-red-500/5',
                  )}>
                    <p className={cn('text-xs', task.status === 'cancelled' ? 'text-amber-400' : 'text-red-400')}>{task.error}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/40">
                <Activity size={24} className="mb-3 opacity-50" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs mt-1">Steps will stream here in real-time as execution progresses.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
