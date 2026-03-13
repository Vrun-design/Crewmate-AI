import React from 'react';
import { TaskStatusIcon } from '../ui/TaskStatusIcon';
import type { Task } from '../../types';
import { getPriorityColor, getPriorityDotColor, getTaskStatusBadge } from './tasksUtils';

interface TaskListProps {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}

export function TaskList({ tasks, onOpenTask }: TaskListProps): React.ReactNode {
  return (
    <>
      <div className="hidden grid-cols-12 gap-4 border-b border-border bg-muted/30 p-4 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid">
        <div className="col-span-5">Task</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Tool</div>
        <div className="col-span-2">Priority</div>
        <div className="col-span-1 text-right">Time</div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2 md:space-y-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenTask(task)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpenTask(task);
              }
            }}
            className="group flex cursor-pointer flex-col items-start gap-3 rounded-xl border border-transparent p-3 transition-colors hover-bg hover:border-border md:grid md:grid-cols-12 md:items-center md:gap-4"
          >
            <div className="col-span-12 flex w-full items-start gap-3 md:col-span-5">
              <div className="mt-0.5 shrink-0">
                <TaskStatusIcon status={task.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                  {task.title}
                </div>
                {/* Failed error reason */}
                {task.status === 'failed' && task.description && (
                  <div className="text-xs text-destructive/80 truncate mt-0.5" title={task.description}>
                    {task.description}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1 md:hidden">
                  <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {task.id}
                  </span>
                  {task.sourceKind === 'delegated' ? (
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-400/20 px-1.5 py-0.5 rounded-full font-medium">AI</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{task.tool}</span>
                </div>
                <div className="mt-0.5 hidden md:flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground">{task.id}</span>
                  {task.sourceKind === 'delegated' ? (
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-400/20 px-1.5 py-0.5 rounded-full font-medium">AI</span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="hidden md:block col-span-2">{getTaskStatusBadge(task.status)}</div>
            <div className="hidden md:flex col-span-2 items-center gap-2 text-sm text-muted-foreground">{task.tool}</div>
            <div className="hidden md:block col-span-2">
              <span className={`text-xs flex items-center gap-1.5 ${getPriorityColor(task.priority)}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${getPriorityDotColor(task.priority)}`} />
                {task.priority}
              </span>
            </div>
            <div className="hidden md:block col-span-1 text-right text-xs text-muted-foreground">{task.time}</div>
          </div>
        ))}
      </div>
    </>
  );
}
