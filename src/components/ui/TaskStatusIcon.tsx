import React from 'react';
import { CheckCircle2, CircleDashed, Clock } from 'lucide-react';
import { Task } from '../../types';

interface TaskStatusIconProps {
  status: Task['status'];
  size?: number;
  className?: string;
}

export function TaskStatusIcon({ status, size = 16, className }: TaskStatusIconProps) {
  if (status === 'completed') return <CheckCircle2 size={size} className={`text-emerald-500 ${className || ''}`} />;
  if (status === 'in_progress') return <CircleDashed size={size} className={`text-blue-500 animate-spin-slow ${className || ''}`} />;
  return <Clock size={size} className={`text-muted-foreground ${className || ''}`} />;
}
