import {useEffect, useState} from 'react';
import {integrationsService} from '../services/integrationsService';
import type {Integration} from '../types';

interface UseIntegrationsResult {
  integrations: Integration[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useIntegrations(): UseIntegrationsResult {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setIsLoading(true);
    try {
      const payload = await integrationsService.getIntegrations();
      setIntegrations(payload);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load integrations');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadIntegrations(): Promise<void> {
      try {
        const payload = await integrationsService.getIntegrations();
        if (isMounted) {
          setIntegrations(payload);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load integrations');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadIntegrations();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    integrations,
    isLoading,
    error,
    refresh,
  };
}
