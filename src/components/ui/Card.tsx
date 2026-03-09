import React from 'react';
import { cn } from '../../utils/cn';

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('subtle-border subtle-bg rounded-2xl shadow-sm overflow-hidden flex flex-col', className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4 border-b border-border bg-muted/30', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn('text-sm font-medium text-foreground flex items-center gap-2', className)} {...props}>
      {children}
    </h2>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-5 flex-1', className)} {...props}>
      {children}
    </div>
  );
}
