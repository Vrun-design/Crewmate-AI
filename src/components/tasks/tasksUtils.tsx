import React from 'react';
import {Badge} from '../ui/Badge';
import type {Task} from '../../types';

export function getTaskStatusBadge(status: Task['status']): React.ReactNode {
  const variant = status === 'completed' ? 'success' : status === 'in_progress' ? 'info' : 'default';
  return <Badge variant={variant}>{status.replace('_', ' ')}</Badge>;
}

export function getPriorityColor(priority: Task['priority']): string {
  if (priority === 'High') {
    return 'text-red-500 dark:text-red-400';
  }

  if (priority === 'Medium') {
    return 'text-amber-500 dark:text-amber-400';
  }

  return 'text-muted-foreground';
}

export function getPriorityDotColor(priority: Task['priority']): string {
  if (priority === 'High') {
    return 'bg-red-500 dark:bg-red-400';
  }

  if (priority === 'Medium') {
    return 'bg-amber-500 dark:bg-amber-400';
  }

  return 'bg-muted-foreground';
}
