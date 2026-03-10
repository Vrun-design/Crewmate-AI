import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardTitle } from '../ui/Card';
import { TaskStatusIcon } from '../ui/TaskStatusIcon';
import type { Task } from '../../types';

interface RecentTasksCardProps {
  tasks: Task[];
}

export function RecentTasksCard({ tasks }: RecentTasksCardProps): React.ReactNode {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <CardTitle>Recent Tasks</CardTitle>
          <Link to="/tasks" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">View All</Link>
        </div>
        <div className="space-y-2">
          {tasks.slice(0, 3).map((task) => (
            <Link
              key={task.id}
              to="/tasks"
              className="group block p-3 rounded-xl hover:bg-muted/30 border border-transparent transition-all -mx-3"
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5">
                  <TaskStatusIcon status={task.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">
                    {task.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{task.tool}</span>
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    <span className="text-xs text-muted-foreground">{task.time}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
