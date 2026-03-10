import React from 'react';
import { StatCard } from '../shared/StatCard';
import type { Integration, Task } from '../../types';
import type { LiveSession } from '../../types/live';

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
        title="Live Tools Executed"
        value={tasks.filter((task) => task.status === 'completed').length.toString()}
        trend="Multimodal capability"
      />
      <StatCard
        title="Memory Nodes Embedded"
        value="12"
        trend="Continuously learning"
      />
      <StatCard
        title="Active Integrations"
        value={integrations.filter((integration) => integration.status === 'connected').length.toString()}
        trend="Ready to act"
      />
      <StatCard
        title="Agent Status"
        value={isSessionActive ? 'On Shift' : 'Idle'}
        trend={isSessionActive ? 'Listening...' : 'Standing by'}
      />
    </div>
  );
}
