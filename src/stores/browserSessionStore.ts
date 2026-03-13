/**
 * browserSessionStore.ts
 *
 * Minimal module-level store (no Zustand/Redux dependency) that tracks the
 * currently running UI Navigator agent task. The BrowserSessionPiP subscribes
 * to changes via a simple listener set.
 */

export interface ActiveBrowserTask {
  taskId: string;   // agent task run ID (used for screenshot polling)
  intent: string;   // first 60 chars of the user's intent
}

type Listener = () => void;

let _active: ActiveBrowserTask | null = null;
const _listeners = new Set<Listener>();

function notify(): void {
  for (const fn of _listeners) fn();
}

export const browserSessionStore = {
  get(): ActiveBrowserTask | null {
    return _active;
  },

  set(task: ActiveBrowserTask): void {
    _active = task;
    notify();
  },

  clear(): void {
    _active = null;
    notify();
  },

  subscribe(fn: Listener): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};
