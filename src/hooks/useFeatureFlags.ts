import { featureFlagsService } from '../services/featureFlagsService';
import { useAsyncResource } from './useAsyncResource';
import type { FeatureFlags } from '../types';

const defaultFlags: FeatureFlags = {
  slackInbound: false,
  approvalGates: false,
  uiNavigator: false,
  researchGrounding: false,
  skillsHub: false,
};

interface UseFeatureFlagsResult {
  flags: FeatureFlags;
  isLoading: boolean;
  error: string | null;
}

export function useFeatureFlags(): UseFeatureFlagsResult {
  const { data, isLoading, error } = useAsyncResource({
    initialData: defaultFlags,
    load: featureFlagsService.get,
    loadErrorMessage: 'Unable to load feature flags',
  });

  return { flags: data, isLoading, error };
}
