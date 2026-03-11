import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, XCircle } from 'lucide-react';
import { AgentStepRow } from './AgentStepRow';
import { getAgentTaskAgentLabel, getAgentTaskDurationSeconds, getAgentTaskStatusMeta } from './agentUi';
import type { AgentTask } from './types';
import { cn } from '../../utils/cn';

type AgentTaskCardProps = {
  task: AgentTask;
  isActive: boolean;
  layout?: 'list' | 'drawer';
  onOpen?: () => void;
};

export function AgentTaskCard({ task, isActive, layout = 'list', onOpen }: AgentTaskCardProps): React.JSX.Element {
  const isDrawerLayout = layout === 'drawer';
  const [expanded, setExpanded] = useState(isActive || isDrawerLayout);

  useEffect(() => {
    if (isActive || isDrawerLayout) {
      setExpanded(true);
    }
  }, [isActive, isDrawerLayout]);

  const steps = task.steps ?? [];
  const duration = getAgentTaskDurationSeconds(task);
  const agentLabel = getAgentTaskAgentLabel(task.agentId);
  const statusMeta = getAgentTaskStatusMeta(task.status);
  const isExpandable = !isDrawerLayout && !onOpen;
  const hasChevron = isExpandable && steps.length > 0;
  const shouldRenderTrace = task.status === 'running' || steps.length > 0;
  const renderedResult = task.result === undefined
    ? ''
    : typeof task.result === 'string'
      ? task.result.slice(0, 800)
      : JSON.stringify(task.result, null, 2).slice(0, 800);
  const uiNavigatorResult = task.result && typeof task.result === 'object'
    ? task.result as {
      finalUrl?: string;
      summary?: string;
      finalObservation?: { screenshotBase64?: string; screenshotMimeType?: string; elements?: unknown[] };
    }
    : null;
  const screenshotData = uiNavigatorResult?.finalObservation?.screenshotBase64 && uiNavigatorResult.finalObservation.screenshotMimeType
    ? `data:${uiNavigatorResult.finalObservation.screenshotMimeType};base64,${uiNavigatorResult.finalObservation.screenshotBase64}`
    : null;
  const isUiNavigatorTask = task.agentId === 'crewmate-ui_navigator-agent' || task.agentId === 'crewmate-ui-navigator-agent';

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

  return (
    <div
      className={cn(
        'rounded-xl border bg-card/50 overflow-hidden transition-all duration-300',
        statusMeta.cardClassName,
        isDrawerLayout && 'border-border/60 bg-transparent shadow-none',
      )}
    >
      {!isDrawerLayout ? (
        <button
          type="button"
          className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/20 transition-colors"
          onClick={onOpen ?? (() => setExpanded((current) => !current))}
        >
          <div
            className={cn(
              'flex-shrink-0 mt-0.5 w-7 h-7 rounded-lg border flex items-center justify-center text-sm',
              statusMeta.iconContainerClassName,
            )}
          >
            {renderStatusIcon()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{agentLabel}</span>
              {duration !== null ? <span className="text-[10px] text-muted-foreground">· {duration}s</span> : null}
              {steps.length > 0 ? <span className="text-[10px] text-muted-foreground">· {steps.length} steps</span> : null}
            </div>
            <p className="text-sm font-medium text-foreground truncate">{task.intent}</p>
            {task.status === 'running' && steps.length > 0 ? (
              <p className="text-xs text-blue-400 mt-0.5 animate-pulse">{steps[steps.length - 1]?.label ?? 'Working...'}</p>
            ) : null}
          </div>

          {hasChevron ? (
            <div className="flex-shrink-0 text-muted-foreground">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          ) : null}
        </button>
      ) : null}

      {isExpandable && expanded && shouldRenderTrace ? (
        <div className={cn('space-y-0', isDrawerLayout ? 'px-0 pt-0 pb-0' : 'px-4 pt-3 pb-4 border-t border-border/50')}>
          {steps.map((step, index) => (
            <React.Fragment key={`${step.taskId}-${step.stepIndex}`}>
              <AgentStepRow step={step} isLast={index === steps.length - 1} />
            </React.Fragment>
          ))}
          {task.status === 'running' ? (
            <div className={cn('flex gap-3 items-center pl-0.5', steps.length > 0 ? 'pt-1' : 'py-3')}>
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                <Loader2 size={13} className="text-blue-400 animate-spin" />
              </div>
              <p className="text-xs text-muted-foreground animate-pulse">
                {steps.length > 0 ? 'Working...' : `${statusMeta.label}. Waiting for first live step...`}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {expanded && task.status === 'completed' && task.result ? (
        <div className={cn(isDrawerLayout ? 'mt-4 rounded-xl border border-border/60 bg-muted/20 p-4' : 'px-4 pt-3 pb-4 border-t border-border/50')}>
          {isUiNavigatorTask && uiNavigatorResult ? (
            <div className="mb-3 space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              {screenshotData ? (
                <img
                  src={screenshotData}
                  alt="UI Navigator final screenshot"
                  className="w-full rounded-lg border border-border/60 object-cover shadow-soft"
                />
              ) : null}
              {uiNavigatorResult.summary ? (
                <p className="text-xs text-foreground">{uiNavigatorResult.summary}</p>
              ) : null}
              {uiNavigatorResult.finalUrl ? (
                <p className="text-xs text-muted-foreground break-all">{uiNavigatorResult.finalUrl}</p>
              ) : null}
            </div>
          ) : null}
          <pre className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">
            {renderedResult}
            {JSON.stringify(task.result ?? '').length > 800 ? '\n[...truncated]' : ''}
          </pre>
        </div>
      ) : null}

      {expanded && task.status === 'failed' && task.error ? (
        <div className={cn(isDrawerLayout ? 'mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4' : 'px-4 pt-3 pb-4 border-t border-red-500/20')}>
          <p className="text-xs text-red-400">{task.error}</p>
        </div>
      ) : null}
    </div>
  );
}
