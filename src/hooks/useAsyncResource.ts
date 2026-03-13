import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserFacingErrorMessage } from '../utils/errorHandling';

interface UseAsyncResourceOptions<TData> {
  enabled?: boolean;
  initialData: TData;
  load: () => Promise<TData>;
  loadErrorMessage: string;
}

interface UseAsyncResourceResult<TData> {
  data: TData;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<TData | null>;
  setData: React.Dispatch<React.SetStateAction<TData>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useAsyncResource<TData>({
  enabled = true,
  initialData,
  load,
  loadErrorMessage,
}: UseAsyncResourceOptions<TData>): UseAsyncResourceResult<TData> {
  const [data, setData] = useState<TData>(initialData);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const initialDataRef = useRef(initialData);
  const loadRef = useRef(load);
  const loadErrorMessageRef = useRef(loadErrorMessage);

  initialDataRef.current = initialData;
  loadRef.current = load;
  loadErrorMessageRef.current = loadErrorMessage;

  const refresh = useCallback(async (): Promise<TData | null> => {
    if (!enabled) {
      setData(initialDataRef.current);
      setError(null);
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);

    try {
      const nextData = await loadRef.current();
      setData(nextData);
      setError(null);
      return nextData;
    } catch (loadError) {
      setError(getUserFacingErrorMessage(loadError, loadErrorMessageRef.current));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setData(initialDataRef.current);
      setError(null);
      setIsLoading(false);
      return;
    }

    void refresh();
  }, [enabled, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    setData,
    setError,
  };
}
