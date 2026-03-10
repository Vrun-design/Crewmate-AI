import { api } from '../lib/api';
import type { Activity, MemoryNode, Session, Task } from '../types';

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
  getMemoryNodes(query?: string): Promise<MemoryNode[]> {
    return api.get<MemoryNode[]>(`/api/memory/nodes${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  },
  toggleMemoryNode(id: string, active: boolean): Promise<{ id: string; active: boolean }> {
    return api.post<{ id: string; active: boolean }>(`/api/memory/nodes/${id}/toggle`, { active });
  },
  ingestMemory(data: { title: string; type: string; searchText: string }): Promise<{ id: string }> {
    return api.post<{ id: string }>('/api/memory/ingest', data);
  }
};
