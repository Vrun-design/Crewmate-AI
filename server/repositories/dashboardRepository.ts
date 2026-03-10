import { db } from '../db';
import { getCurrentSessionForUser } from './sessionRepository';
import { listActivities, listTasks } from './workspaceRepository';
import { listIntegrationCatalog } from '../services/integrationCatalog';
import type {
  DashboardPayload,
  MemoryNodeRecord,
} from '../types';

export function getDashboardPayload(workspaceId: string, userId: string): DashboardPayload {
  const tasks = listTasks(userId).slice(0, 6);
  const activities = listActivities(userId).slice(0, 8);
  const integrations = listIntegrationCatalog(workspaceId, userId);

  const memoryNodes = db.prepare(`
    SELECT id, title, type, tokens, last_synced as lastSynced, active
    FROM memory_nodes
    WHERE user_id = ?
    ORDER BY id ASC
  `).all(userId).map((row) => ({
    ...row,
    active: Boolean((row as { active: number }).active),
  })) as MemoryNodeRecord[];

  return {
    tasks,
    activities,
    integrations,
    memoryNodes,
    currentSession: getCurrentSessionForUser(userId),
  };
}
