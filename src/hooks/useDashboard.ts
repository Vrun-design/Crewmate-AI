import {useEffect, useState} from 'react';
import {dashboardService} from '../services/dashboardService';
import type {DashboardData} from '../types/live';

interface UseDashboardResult {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setError(null);
    const next = await dashboardService.getDashboard();
    setData(next);
  };

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const next = await dashboardService.getDashboard();
        if (isMounted) {
          setData(next);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  return {data, isLoading, error, refresh};
}
