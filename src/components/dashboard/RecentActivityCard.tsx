import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardTitle } from '../ui/Card';
import { Tooltip } from '../ui/Tooltip';
import type { Activity } from '../../types';
import { getActivityIcon } from './dashboardUtils';

interface RecentActivityCardProps {
  activities: Activity[];
}

export function RecentActivityCard({ activities }: RecentActivityCardProps): React.ReactNode {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <CardTitle>Recent Activity</CardTitle>
          <Link to="/sessions?tab=activity" className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">View All</Link>
        </div>
        <div className="space-y-2">
          {activities.slice(0, 4).map((activity) => (
            <Link
              key={activity.id}
              to="/sessions?tab=activity"
              className="group block p-3 rounded-xl hover:bg-muted/30 border border-transparent transition-all -mx-3"
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 group-hover:bg-background transition-colors">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <Tooltip content={activity.title} className="block truncate text-left">
                    <div className="text-sm font-medium truncate group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">
                      {activity.title}
                    </div>
                  </Tooltip>
                  <Tooltip content={activity.description} delayMs={500} className="block truncate text-left">
                    <div className="text-[13px] text-muted-foreground truncate mt-0.5">{activity.description}</div>
                  </Tooltip>
                  <div className="flex items-center mt-1">
                    <span className="text-xs text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity">{activity.time}</span>
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
