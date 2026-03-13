import { db } from '../db';
import { getCurrentSessionForUser } from './sessionRepository';
import { getTaskRecord, listActivities, listActiveTaskRuns, listTasks } from './workspaceRepository';
import { listIntegrationCatalog } from '../services/integrationCatalog';
import type { DashboardPayload } from '../types';

export function getDashboardPayload(workspaceId: string, userId: string): DashboardPayload {
  const tasks = listTasks(userId).slice(0, 6);
  const activeRuns = listActiveTaskRuns(userId, 3);
  const activities = listActivities(userId).slice(0, 8);
  const integrations = listIntegrationCatalog(workspaceId, userId);
  const activeItems = activeRuns
    .map((run) => {
      const task = getTaskRecord(run.taskId, userId);
      if (!task) {
        return null;
      }

      const routeType = run.runType === 'delegated_agent' ? 'delegated_agent' : 'delegated_skill';
      return {
        id: task.id,
        intent: task.title,
        status: run.status as 'queued' | 'running',
        routeType,
        originType: run.originType === 'app' || run.originType === 'live_session' || run.originType === 'command'
          ? run.originType
          : undefined,
      };
    })
    .filter(Boolean) as NonNullable<DashboardPayload['activeTaskSummary']>['items'];

  return {
    tasks,
    activities,
    integrations,
    currentSession: getCurrentSessionForUser(userId),
    activeTaskSummary: {
      count: activeItems.length,
      liveOriginCount: activeItems.filter((task) => task.originType === 'live_session').length,
      items: activeItems,
    },
  };
}
