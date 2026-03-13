import React from 'react';
import { AlignLeft, Clock } from 'lucide-react';
import type { Activity } from '../../types';
import { Button } from '../ui/Button';
import { PropertyRow } from '../ui/PropertyRow';
import { getActivityBadge } from './activityLogUtils';

interface ActivityDrawerContentProps {
  activity: Activity | null;
}

export function ActivityDrawerContent({ activity }: ActivityDrawerContentProps): React.ReactNode {
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

      <div className="rounded-xl border border-border/50 bg-secondary/20 p-4">
        <PropertyRow icon={Clock} label="Time" value={activity.time} />
        <PropertyRow icon={AlignLeft} label="Type">
          <span className="capitalize">{activity.type}</span>
        </PropertyRow>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground flex items-center gap-2">
          <AlignLeft size={16} className="text-muted-foreground" />
          Description
        </div>
        <div className="text-sm text-foreground/90 font-medium leading-relaxed">
          {activity.description}
        </div>
      </div>

      <div className="flex gap-3 border-t border-border pt-4">
        <Button variant="secondary" className="flex-1">
          View Raw Context
        </Button>
      </div>
    </div>
  );
}
