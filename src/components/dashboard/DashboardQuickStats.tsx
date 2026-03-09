import React from 'react';
import {StatCard} from '../shared/StatCard';
import type {Integration, Task} from '../../types';
import type {LiveSession} from '../../types/live';

interface DashboardQuickStatsProps {
  tasks: Task[];
  integrations: Integration[];
  session: LiveSession | null;
  isSessionActive: boolean;
}

export function DashboardQuickStats({
  tasks,
  integrations,
  session,
  isSessionActive,
}: DashboardQuickStatsProps): React.ReactNode {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Tasks Completed"
        value={tasks.filter((task) => task.status === 'completed').length.toString()}
        trend="Live local data"
      />
      <StatCard title="Hours Saved" value="8.5h" trend="Prototype baseline" />
      <StatCard
        title="Active Integrations"
        value={integrations.filter((integration) => integration.status === 'connected').length.toString()}
      />
      <StatCard title="Sessions Today" value={session ? '1' : '0'} trend={isSessionActive ? 'Live now' : 'Idle'} />
    </div>
  );
}
