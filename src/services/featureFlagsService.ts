import { api } from '../lib/api';
import type { FeatureFlags } from '../types';

export const featureFlagsService = {
  get(): Promise<FeatureFlags> {
    return api.get('/api/feature-flags');
  },
};
