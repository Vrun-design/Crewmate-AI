import React from 'react';
import { CheckCircle2, CircleDashed, Clock } from 'lucide-react';
import type { Task } from '../../types';

interface TaskStatusIconProps {
  status: Task['status'];
  size?: number;
  className?: string;
}

export function TaskStatusIcon({ status, size = 16, className }: TaskStatusIconProps) {
  if (status === 'completed') {
    return <CheckCircle2 size={size} className={`text-emerald-500 ${className || ''}`} />;
  }

  if (status === 'in_progress') {
    return <CircleDashed size={size} className={`animate-spin-slow text-primary ${className || ''}`} />;
  }

  return <Clock size={size} className={`text-muted-foreground ${className || ''}`} />;
}
