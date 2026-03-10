import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface DashboardEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  actionTo: string;
}

export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
}: DashboardEmptyStateProps): React.ReactNode {
  return (
    <div className="flex min-h-[196px] items-center justify-center rounded-2xl border border-dashed border-border/80 bg-secondary/35 px-6 py-8 text-center">
      <div className="max-w-xs">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background text-muted-foreground shadow-soft">
          <Icon size={18} />
        </div>
        <div className="mt-4 text-sm font-medium text-foreground">{title}</div>
        <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">{description}</p>
        <Link
          to={actionTo}
          className="mt-4 inline-flex items-center justify-center rounded-full border border-border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}
