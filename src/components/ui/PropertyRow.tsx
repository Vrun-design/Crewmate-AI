import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface PropertyRowProps {
  icon?: LucideIcon;
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}

export function PropertyRow({ icon: Icon, label, value, children }: PropertyRowProps): React.JSX.Element {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center py-3 border-b border-border/40 last:border-0 hover:bg-muted/5 transition-colors group">
      <div className="text-xs text-muted-foreground flex items-center gap-2 sm:w-1/3 shrink-0">
        {Icon ? <Icon size={14} className="opacity-70 group-hover:text-primary transition-colors" /> : null}
        {label}
      </div>
      <div className="text-sm font-medium text-foreground mt-1 sm:mt-0 flex-1">
        {value ?? children}
      </div>
    </div>
  );
}
