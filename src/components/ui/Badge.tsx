import React from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children?: React.ReactNode;
  className?: string;
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider border shrink-0',
        {
          'bg-secondary border-border text-muted-foreground': variant === 'default',
          'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400': variant === 'success',
          'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400': variant === 'warning',
          'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400': variant === 'danger',
          'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400': variant === 'info',
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
