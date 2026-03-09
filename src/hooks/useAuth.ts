import {useEffect, useState} from 'react';
import {authService, authStorage} from '../services/authService';
import type {AuthUser} from '../types';

interface UseAuthResult {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadUser(): Promise<void> {
      if (!authStorage.isAuthenticated()) {
        if (isMounted) {
          setIsLoading(false);
          setUser(null);
        }
        return;
      }

      try {
        const nextUser = await authService.me();
        if (isMounted) {
          setUser(nextUser);
          setError(null);
        }
      } catch (loadError) {
        authStorage.clearSession();
        if (isMounted) {
          setUser(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load auth session');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  return {user, isLoading, error};
}
