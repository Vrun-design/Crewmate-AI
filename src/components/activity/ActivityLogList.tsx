import React from 'react';
import type {Activity} from '../../types';
import {getActivityBadge, getActivityListIcon} from './activityLogUtils';

interface ActivityLogListProps {
  activities: Activity[];
  onOpenActivity: (activity: Activity) => void;
}

export function ActivityLogList({activities, onOpenActivity}: ActivityLogListProps): React.ReactNode {
  return (
    <>
      <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/30">
        <div className="col-span-7">Activity</div>
        <div className="col-span-3">Type</div>
        <div className="col-span-2 text-right">Time</div>
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-2 md:space-y-1">
        {activities.map((activity) => (
          <div
            key={activity.id}
            onClick={() => onOpenActivity(activity)}
            className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 p-3 rounded-xl hover-bg items-start md:items-center transition-colors cursor-pointer group border border-transparent hover:border-border"
          >
            <div className="col-span-12 md:col-span-7 flex items-start gap-3 w-full">
              <div className="mt-0.5 w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0">
                {getActivityListIcon(activity.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {activity.title}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{activity.description}</div>
                <div className="flex items-center gap-2 mt-1 md:hidden">
                  <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    {activity.id}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{activity.type}</span>
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1 hidden md:block">{activity.id}</div>
              </div>
            </div>
            <div className="hidden md:block col-span-3">{getActivityBadge(activity.type)}</div>
            <div className="hidden md:block col-span-2 text-right text-xs text-muted-foreground">{activity.time}</div>
          </div>
        ))}
      </div>
    </>
  );
}
