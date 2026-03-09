import {useEffect, useState} from 'react';
import {preferencesService} from '../services/preferencesService';
import type {UserPreferences} from '../types';

interface UsePreferencesResult {
  preferences: UserPreferences | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  savePreferences: (preferences: UserPreferences) => Promise<void>;
}

export function usePreferences(): UsePreferencesResult {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    preferencesService
      .get()
      .then((nextPreferences) => {
        if (isMounted) {
          setPreferences(nextPreferences);
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load preferences');
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
  }, []);

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
