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
      <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
        <div className="col-span-5">Task</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Tool</div>
        <div className="col-span-2">Priority</div>
        <div className="col-span-1 text-right">Time</div>
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-2 md:space-y-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onOpenTask(task)}
            className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 p-3 rounded-xl hover-bg items-start md:items-center transition-colors cursor-pointer group border border-transparent hover:border-border"
          >
            <div className="col-span-12 md:col-span-5 flex items-start gap-3 w-full">
              <div className="mt-0.5 shrink-0">
                <TaskStatusIcon status={task.status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                  {task.title}
                </div>
                <div className="flex items-center gap-2 mt-1 md:hidden">
                  <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {task.id}
                  </span>
                  <span className="text-xs text-muted-foreground">{task.tool}</span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5 hidden md:block">{task.id}</div>
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
