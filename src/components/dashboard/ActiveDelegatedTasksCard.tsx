import React from 'react';
import { Bot, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardTitle } from '../ui/Card';
import { DashboardEmptyState } from './DashboardEmptyState';
import type { DashboardData } from '../../types/live';

interface ActiveDelegatedTasksCardProps {
  summary?: DashboardData['activeTaskSummary'];
}

export function ActiveDelegatedTasksCard({ summary }: ActiveDelegatedTasksCardProps): React.ReactNode {
  const items = summary?.items ?? [];

  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <CardTitle>Background Work</CardTitle>
          <Link to="/tasks" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            Open Tasks
          </Link>
        </div>

        {items.length > 0 ? (
          <div className="space-y-2">
            {items.slice(0, 3).map((task) => (
              <Link
                key={task.id}
                to={`/tasks?task=${encodeURIComponent(task.id)}`}
                className="group block rounded-xl border border-transparent p-3 -mx-3 hover:bg-muted/30 transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
                    <Bot size={15} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-blue-400">
                        {task.originType === 'live_session' ? 'Live' : 'Delegated'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {task.status === 'running' ? 'Running' : 'Queued'}
                      </span>
                    </div>
                    <div className="mt-1 text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {task.intent}
                    </div>
                  </div>
                  <ArrowRight size={14} className="mt-1 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <DashboardEmptyState
            icon={Bot}
            title="No background work"
            description="Delegated live actions and async workflows will show up here while they run."
            actionLabel="Open Tasks"
            actionTo="/tasks"
          />
        )}
      </CardContent>
    </Card>
  );
}
