import {useEffect, useState} from 'react';
import {integrationsService} from '../services/integrationsService';
import type {IntegrationConfigState} from '../types';

interface UseIntegrationConfigResult {
  config: IntegrationConfigState | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  saveConfig: (values: Record<string, string>) => Promise<void>;
  clearConfig: () => Promise<void>;
}

export function useIntegrationConfig(integrationId: string | null, enabled = true): UseIntegrationConfigResult {
  const [config, setConfig] = useState<IntegrationConfigState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!integrationId || !enabled) {
      setConfig(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    integrationsService
      .getConfig(integrationId)
      .then((nextConfig) => {
        if (isMounted) {
          setConfig(nextConfig);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load integration config');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [integrationId, enabled]);

  async function saveConfig(values: Record<string, string>): Promise<void> {
    if (!integrationId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const nextConfig = await integrationsService.saveConfig(integrationId, values);
      setConfig(nextConfig);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save integration config');
    } finally {
      setIsSaving(false);
    }
  }

  async function clearConfig(): Promise<void> {
    if (!integrationId) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await integrationsService.deleteConfig(integrationId);
      const nextConfig = await integrationsService.getConfig(integrationId);
      setConfig(nextConfig);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : 'Unable to clear integration config');
    } finally {
      setIsSaving(false);
    }
  }

  return {config, isLoading, isSaving, error, saveConfig, clearConfig};
}
