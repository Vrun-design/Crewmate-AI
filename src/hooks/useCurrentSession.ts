import { liveSessionService } from '../services/liveSessionService';
import { useAsyncResource } from './useAsyncResource';
import type { LiveSession } from '../types/live';

interface UseCurrentSessionResult {
  session: LiveSession | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCurrentSession(enabled = true): UseCurrentSessionResult {
  const { data, isLoading, error, refresh } = useAsyncResource<LiveSession | null>({
    enabled,
    initialData: null,
    load: liveSessionService.getCurrentSession,
    loadErrorMessage: 'Unable to load current session',
  });

  return {
    session: data,
    isLoading,
    error,
    refresh: async () => {
      await refresh();
    },
  };
}
