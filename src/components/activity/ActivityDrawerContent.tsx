import React from 'react';
import {AlignLeft, Clock} from 'lucide-react';
import {Button} from '../ui/Button';
import {getActivityBadge} from './activityLogUtils';
import type {Activity} from '../../types';

interface ActivityDrawerContentProps {
  activity: Activity | null;
}

export function ActivityDrawerContent({activity}: ActivityDrawerContentProps): React.ReactNode {
  if (!activity) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded-md">{activity.id}</span>
          {getActivityBadge(activity.type)}
        </div>
        <h3 className="text-xl font-semibold text-foreground">{activity.title}</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock size={14} /> Time
          </div>
          <div className="text-sm font-medium text-foreground">{activity.time}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlignLeft size={14} /> Type
          </div>
          <div className="text-sm font-medium text-foreground capitalize">{activity.type}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground flex items-center gap-2">
          <AlignLeft size={16} className="text-muted-foreground" />
          Description
        </div>
        <div className="text-sm text-muted-foreground bg-secondary/50 p-4 rounded-xl border border-border">
          {activity.description}
        </div>
      </div>

      <div className="pt-4 border-t border-border flex gap-3">
        <Button variant="secondary" className="flex-1">
          View Raw Context
        </Button>
      </div>
    </div>
  );
}
