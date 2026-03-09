import React from 'react';
import {Card, CardContent, CardTitle} from '../ui/Card';
import {TaskStatusIcon} from '../ui/TaskStatusIcon';
import type {Task} from '../../types';

interface RecentTasksCardProps {
  tasks: Task[];
}

export function RecentTasksCard({tasks}: RecentTasksCardProps): React.ReactNode {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Recent Tasks</CardTitle>
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">View All</button>
        </div>
        <div className="space-y-3">
          {tasks.slice(0, 3).map((task) => (
            <div
              key={task.id}
              className="group p-3 rounded-xl hover-bg border border-transparent hover:border-border transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <TaskStatusIcon status={task.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                      {task.id}
                    </span>
                    <span className="text-xs text-muted-foreground">{task.tool}</span>
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    <span className="text-xs text-muted-foreground">{task.time}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
