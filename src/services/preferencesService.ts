import {api} from '../lib/api';
import type {UserPreferences} from '../types';

export const preferencesService = {
  get(): Promise<UserPreferences> {
    return api.get('/api/preferences');
  },
  save(preferences: UserPreferences): Promise<UserPreferences> {
    return api.put('/api/preferences', preferences);
  },
};
