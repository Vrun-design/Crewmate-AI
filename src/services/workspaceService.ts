import {api} from '../lib/api';
import type {Activity, MemoryNode, Session, Task} from '../types';

export const workspaceService = {
  getTasks(): Promise<Task[]> {
    return api.get<Task[]>('/api/tasks');
  },
  getActivities(): Promise<Activity[]> {
    return api.get<Activity[]>('/api/activities');
  },
  getSessions(): Promise<Session[]> {
    return api.get<Session[]>('/api/sessions/history');
  },
  getMemoryNodes(): Promise<MemoryNode[]> {
    return api.get<MemoryNode[]>('/api/memory/nodes');
  },
};
