import {useEffect, useState} from 'react';
import {capabilityService} from '../services/capabilityService';
import type {Capability} from '../types';

interface UseCapabilitiesResult {
  capabilities: Capability[];
  isLoading: boolean;
  error: string | null;
}

export function useCapabilities(): UseCapabilitiesResult {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCapabilities(): Promise<void> {
      try {
        const payload = await capabilityService.getCapabilities();
        if (isMounted) {
          setCapabilities(payload);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load capabilities');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCapabilities();

    return () => {
      isMounted = false;
    };
  }, []);

  return {capabilities, isLoading, error};
}
