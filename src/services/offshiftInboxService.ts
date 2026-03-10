import { api } from '../lib/api';
import type { OffshiftWorkItem } from '../types';

export const offshiftInboxService = {
  list(): Promise<OffshiftWorkItem[]> {
    return api.get('/api/offshift/inbox');
  },
};
