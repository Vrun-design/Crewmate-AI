import React from 'react';
import {Card, CardContent, CardTitle} from '../ui/Card';
import type {Activity} from '../../types';
import {getActivityIcon} from './dashboardUtils';

interface RecentActivityCardProps {
  activities: Activity[];
}

export function RecentActivityCard({activities}: RecentActivityCardProps): React.ReactNode {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Recent Activity</CardTitle>
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">View All</button>
        </div>
        <div className="space-y-3">
          {activities.slice(0, 4).map((activity) => (
            <div
              key={activity.id}
              className="group p-3 rounded-xl hover-bg border border-transparent hover:border-border transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {activity.title}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{activity.description}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                      {activity.id}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border"></span>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
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
