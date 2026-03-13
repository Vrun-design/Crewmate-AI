/**
 * useBrowserSession
 *
 * Polls /api/agents/tasks/:id/screenshot every 2s while a UI Navigator task
 * is active. Returns the latest screenshot URL, current browser URL, step count,
 * and task status for driving the BrowserSessionPiP.
 */
import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { browserSessionStore, type ActiveBrowserTask } from '../stores/browserSessionStore';

export interface BrowserSessionSnapshot {
  screenshotUrl: string | null;
  currentUrl: string | null;
  stepCount: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  intent: string;
  capturedAt: string | null;
}

const POLL_INTERVAL_MS = 2000;

export function useBrowserSession(): {
  active: ActiveBrowserTask | null;
  snapshot: BrowserSessionSnapshot | null;
} {
  const [active, setActive] = useState<ActiveBrowserTask | null>(() => browserSessionStore.get());
  const [snapshot, setSnapshot] = useState<BrowserSessionSnapshot | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to store changes
  useEffect(() => {
    return browserSessionStore.subscribe(() => {
      setActive(browserSessionStore.get());
    });
  }, []);

  // Poll screenshot endpoint while active
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (!active) {
      setSnapshot(null);
      return;
    }

    async function fetchSnapshot() {
      if (!active) return;
      try {
        const data = await api.get<BrowserSessionSnapshot>(
          `/api/agents/tasks/${active.taskId}/screenshot`,
        );
        setSnapshot(data);

        // Auto-clear when task finishes
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          // Keep snapshot visible for 4s after completion so user can see final state
          setTimeout(() => browserSessionStore.clear(), 4000);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Non-fatal — keep polling
      }
    }

    void fetchSnapshot();
    pollRef.current = setInterval(() => void fetchSnapshot(), POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [active]);

  return { active, snapshot };
}
