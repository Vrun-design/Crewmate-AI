import { useEffect } from 'react';
import { UI_NAVIGATOR_AGENT_ID } from '../constants/agents';
import { useLiveEvents } from './useLiveEvents';
import { api } from '../lib/api';
import { browserSessionStore } from '../stores/browserSessionStore';

interface BrowserSessionAgentTask {
  id: string;
  agentId: string;
  intent: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
}

function isLiveUiNavigatorTask(task: BrowserSessionAgentTask): boolean {
  return task.agentId === UI_NAVIGATOR_AGENT_ID && (task.status === 'queued' || task.status === 'running');
}

export function useBrowserSessionActivation(): void {
  useLiveEvents({
    onLiveTaskUpdate: (event) => {
      if (event.agentId !== UI_NAVIGATOR_AGENT_ID) {
        return;
      }

      if (event.status === 'running') {
        browserSessionStore.set({
          taskId: event.taskRunId,
          intent: event.title.slice(0, 120),
        });
      }
    },
  });

  useEffect(() => {
    let isCancelled = false;

    async function hydrateActiveBrowserSession(): Promise<void> {
      if (browserSessionStore.get()) {
        return;
      }

      try {
        const tasks = await api.get<BrowserSessionAgentTask[]>('/api/agents/tasks?limit=10');
        if (isCancelled) {
          return;
        }

        const activeTask = tasks.find(isLiveUiNavigatorTask);
        if (!activeTask) {
          return;
        }

        browserSessionStore.set({
          taskId: activeTask.id,
          intent: activeTask.intent.slice(0, 120),
        });
      } catch {
        // Non-fatal. Live task SSE will still activate the PiP for new runs.
      }
    }

    void hydrateActiveBrowserSession();

    return () => {
      isCancelled = true;
    };
  }, []);
}
