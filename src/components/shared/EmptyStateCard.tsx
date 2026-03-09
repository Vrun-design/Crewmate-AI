import React from 'react';

interface EmptyStateCardProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyStateCard({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateCardProps): React.ReactNode {
  return (
    <div className="flex h-full min-h-[240px] items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-secondary/30 px-6 py-10 text-center">
        <div className="text-lg font-medium text-foreground">{title}</div>
        <div className="mt-2 text-sm text-muted-foreground">{description}</div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-5 inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
