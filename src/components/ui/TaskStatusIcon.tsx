import React from 'react';
import { Ban, CheckCircle2, CircleDashed, Clock, XCircle } from 'lucide-react';
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

  if (status === 'failed') {
    return <XCircle size={size} className={`text-red-500 ${className || ''}`} />;
  }

  if (status === 'cancelled') {
    return <Ban size={size} className={`text-amber-500 ${className || ''}`} />;
  }

  return <Clock size={size} className={`text-muted-foreground ${className || ''}`} />;
}
