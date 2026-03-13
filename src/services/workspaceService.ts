import { api } from '../lib/api';
import type { Activity, Session, Task, TaskDetail, TaskRun } from '../types';

export const workspaceService = {
  getTasks(): Promise<Task[]> {
    return api.get<Task[]>('/api/tasks');
  },
  createTask(data: { title: string; description?: string; tool: string; priority: Task['priority']; mode?: 'manual' | 'delegated' }): Promise<Task | TaskDetail> {
    return api.post<Task | TaskDetail>('/api/tasks', data);
  },
  getTask(id: string): Promise<TaskDetail> {
    return api.get<TaskDetail>(`/api/tasks/${id}`);
  },
  getTaskRuns(id: string): Promise<TaskRun[]> {
    return api.get<TaskRun[]>(`/api/tasks/${id}/runs`);
  },
  cancelTask(id: string): Promise<TaskDetail> {
    return api.post<TaskDetail>(`/api/tasks/${id}/cancel`);
  },
  getActivities(): Promise<Activity[]> {
    return api.get<Activity[]>('/api/activities');
  },
  getSessions(): Promise<Session[]> {
    return api.get<Session[]>('/api/sessions/history');
  },
  ingestMemory(data: { title: string; type: string; searchText: string; kind?: 'knowledge' | 'artifact'; url?: string }): Promise<{ id: string }> {
    return api.post<{ id: string }>('/api/memory/ingest', data);
  }
};
