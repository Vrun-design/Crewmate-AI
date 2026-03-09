import {useEffect, useState} from 'react';

interface UseWorkspaceCollectionResult<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
}

export function useWorkspaceCollection<T>(load: () => Promise<T[]>): UseWorkspaceCollectionResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData(): Promise<void> {
      try {
        const payload = await load();
        if (isMounted) {
          setData(payload);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load data');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [load]);

  return {
    data,
    isLoading,
    error,
  };
}
