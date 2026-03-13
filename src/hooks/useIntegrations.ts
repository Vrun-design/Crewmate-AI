import {integrationsService} from '../services/integrationsService';
import {useAsyncResource} from './useAsyncResource';
import type {Integration} from '../types';

interface UseIntegrationsResult {
  integrations: Integration[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useIntegrations(): UseIntegrationsResult {
  const { data, isLoading, error, refresh } = useAsyncResource({
    initialData: [] as Integration[],
    load: integrationsService.getIntegrations,
    loadErrorMessage: 'Unable to load integrations',
  });

  return {
    integrations: data,
    isLoading,
    error,
    refresh: async () => {
      await refresh();
    },
  };
}
