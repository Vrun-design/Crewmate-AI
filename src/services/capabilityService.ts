import {api} from '../lib/api';
import type {Capability} from '../types';

export const capabilityService = {
  getCapabilities(): Promise<Capability[]> {
    return api.get('/api/capabilities');
  },
};
