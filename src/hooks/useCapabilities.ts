import {capabilityService} from '../services/capabilityService';
import {useAsyncResource} from './useAsyncResource';
import type {Capability} from '../types';

interface UseCapabilitiesResult {
  capabilities: Capability[];
  isLoading: boolean;
  error: string | null;
}

export function useCapabilities(): UseCapabilitiesResult {
  const { data, isLoading, error } = useAsyncResource({
    initialData: [] as Capability[],
    load: capabilityService.getCapabilities,
    loadErrorMessage: 'Unable to load capabilities',
  });

  return {capabilities: data, isLoading, error};
}
