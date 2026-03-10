import { useCallback, useEffect, useState } from 'react';
import { offshiftInboxService } from '../services/offshiftInboxService';
import { useLiveEvents } from './useLiveEvents';
import type { OffshiftWorkItem } from '../types';

interface UseOffshiftInboxResult {
  items: OffshiftWorkItem[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useOffshiftInbox(enabled: boolean): UseOffshiftInboxResult {
  const [items, setItems] = useState<OffshiftWorkItem[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled) {
      setItems([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      const payload = await offshiftInboxService.list();
      setItems(payload);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load off-shift inbox');
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    setIsLoading(enabled);
    void refresh();
  }, [enabled, refresh]);

  useLiveEvents({
    onJobUpdate: useCallback(() => {
      void refresh();
    }, [refresh]),
  });

  return { items, isLoading, error, refresh };
}
