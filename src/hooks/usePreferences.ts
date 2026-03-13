import {useState} from 'react';
import {preferencesService} from '../services/preferencesService';
import {useAsyncResource} from './useAsyncResource';
import type {UserPreferences} from '../types';

interface UsePreferencesResult {
  preferences: UserPreferences | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  savePreferences: (preferences: UserPreferences) => Promise<void>;
}

export function usePreferences(enabled = true): UsePreferencesResult {
  const {
    data: preferences,
    isLoading,
    error,
    refresh,
    setData: setPreferences,
    setError,
  } = useAsyncResource<UserPreferences | null>({
    enabled,
    initialData: null,
    load: preferencesService.get,
    loadErrorMessage: 'Unable to load preferences',
  });
  const [isSaving, setIsSaving] = useState(false);

  async function savePreferences(nextPreferences: UserPreferences): Promise<void> {
    setIsSaving(true);
    setError(null);

    try {
      const saved = await preferencesService.save(nextPreferences);
      setPreferences(saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save preferences');
    } finally {
      setIsSaving(false);
    }
  }

  return {preferences, isLoading, isSaving, error, savePreferences};
}
