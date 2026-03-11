import { useEffect, useState } from 'react';
import { featureFlagsService } from '../services/featureFlagsService';
import type { FeatureFlags } from '../types';

const defaultFlags: FeatureFlags = {
  offshiftInbox: false,
  jobTypesV2: false,
  slackInbound: false,
  approvalGates: false,
  uiNavigator: false,
  researchGrounding: false,
};

interface UseFeatureFlagsResult {
  flags: FeatureFlags;
  isLoading: boolean;
  error: string | null;
}

export function useFeatureFlags(): UseFeatureFlagsResult {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFlags(): Promise<void> {
      try {
        const payload = await featureFlagsService.get();
        if (isMounted) {
          setFlags(payload);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load feature flags');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadFlags();

    return () => {
      isMounted = false;
    };
  }, []);

  return { flags, isLoading, error };
}
