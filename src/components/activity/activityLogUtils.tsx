import React from 'react';
import {Badge} from '../ui/Badge';
import type {Activity} from '../../types';
import {getActivityIcon} from '../dashboard/dashboardUtils';

export function getActivityBadge(type: Activity['type']): React.ReactNode {
  return (
    <Badge variant="default" className="capitalize">
      {type}
    </Badge>
  );
}

export function getActivityListIcon(type: Activity['type']): React.ReactNode {
  return getActivityIcon(type);
}
