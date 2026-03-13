import React, { useState } from 'react';
import { STEP_COLORS, STEP_TYPE_LABELS, StepIcon } from './agentUi';
import type { AgentStepEvent } from './types';

type AgentStepRowProps = {
  step: AgentStepEvent;
  isLast: boolean;
};

const DETAIL_PREVIEW_LENGTH = 140;

export function AgentStepRow({ step, isLast }: AgentStepRowProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasLongDetail = (step.detail?.length ?? 0) > DETAIL_PREVIEW_LENGTH;
  const detailText = !step.detail || isExpanded || !hasLongDetail
    ? step.detail
    : `${step.detail.slice(0, DETAIL_PREVIEW_LENGTH).trimEnd()}...`;

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div className={`flex items-center justify-center w-5 h-5 rounded-full border ${STEP_COLORS[step.type]} flex-shrink-0 mt-0.5`}>
          <StepIcon type={step.type} />
        </div>
        {!isLast ? <div className="w-px flex-1 bg-border/50 my-1" /> : null}
      </div>

      <div className="pb-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STEP_COLORS[step.type]}`}>
            {STEP_TYPE_LABELS[step.type]}
          </span>
          {step.skillId ? (
            <span className="text-[10px] font-mono text-muted-foreground bg-secondary rounded px-1.5 py-0.5">{step.skillId}</span>
          ) : null}
          {step.durationMs !== undefined ? <span className="text-[10px] text-muted-foreground">{step.durationMs}ms</span> : null}
        </div>
        <p className="text-sm text-foreground mt-1">{step.label}</p>
        {detailText ? (
          <div className="mt-0.5">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words">{detailText}</p>
            {hasLongDetail ? (
              <button
                type="button"
                className="mt-1 text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors"
                onClick={() => setIsExpanded((current) => !current)}
              >
                {isExpanded ? 'See less' : 'See more'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
