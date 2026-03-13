import {dashboardService} from '../services/dashboardService';
import {useAsyncResource} from './useAsyncResource';
import type {DashboardData} from '../types/live';

interface UseDashboardResult {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useDashboard(): UseDashboardResult {
  const { data, isLoading, error, refresh } = useAsyncResource<DashboardData | null>({
    initialData: null,
    load: dashboardService.getDashboard,
    loadErrorMessage: 'Unable to load dashboard',
  });

  return {
    data,
    isLoading,
    error,
    refresh: async () => {
      await refresh();
    },
  };
}
