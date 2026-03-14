import type { JSX } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { LiveTaskCue, LiveTaskCueStatus } from '../../types/liveTaskCue';
import { cn } from '../../utils/cn';

interface LiveTaskCueBadgeProps {
  cue: LiveTaskCue;
  className?: string;
  completedLabel?: string;
  failedLabel?: string;
  separator?: string;
  showIcon?: boolean;
  titleMaxLength?: number;
  variant?: 'default' | 'dashboard';
}

interface CuePresentation {
  className: string;
  icon: JSX.Element;
  label: string;
}

function getCuePresentation(
  status: LiveTaskCueStatus,
  completedLabel: string,
  failedLabel: string,
  variant: 'default' | 'dashboard',
): CuePresentation {
  if (status === 'running') {
    return {
      className: variant === 'dashboard'
        ? 'border-primary/20 bg-primary/5 text-primary'
        : 'border-primary/30 bg-primary/10 text-primary',
      icon: <Loader2 size={14} className="shrink-0 animate-spin" />,
      label: 'Working on it',
    };
  }

  if (status === 'completed') {
    return {
      className: variant === 'dashboard'
        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
      icon: <CheckCircle2 size={14} className="shrink-0" />,
      label: completedLabel,
    };
  }

  return {
    className: variant === 'dashboard'
      ? 'border-amber-500/20 bg-amber-500/5 text-amber-400'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    icon: <XCircle size={14} className="shrink-0" />,
    label: failedLabel,
  };
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

export function LiveTaskCueBadge({
  cue,
  className,
  completedLabel = 'Done',
  failedLabel = 'Failed',
  separator = '—',
  showIcon = true,
  titleMaxLength = 80,
  variant = 'default',
}: LiveTaskCueBadgeProps): JSX.Element {
  const presentation = getCuePresentation(cue.status, completedLabel, failedLabel, variant);

  return (
    <div
      className={cn(
        'min-w-0 flex items-center gap-2 rounded-full border px-4 py-2 text-sm',
        presentation.className,
        className,
      )}
    >
      {showIcon ? presentation.icon : null}
      <span className="font-medium">{presentation.label}</span>
      {separator ? <span className="opacity-50">{separator}</span> : null}
      <span className="min-w-0 truncate">{truncateText(cue.title, titleMaxLength)}</span>
    </div>
  );
}
