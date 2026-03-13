import { useCallback, useEffect, useState } from 'react';
import { notificationService } from '../services/notificationService';
import { getUserFacingErrorMessage } from '../utils/errorHandling';
import { useLiveEvents } from './useLiveEvents';
import type { Notification } from '../types';

interface UseNotificationsResult {
  notifications: Notification[];
  isLoading: boolean;
  error: string | null;
  markAllRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const payload = await notificationService.getNotifications();
      setNotifications(payload);
      setError(null);
    } catch (loadError) {
      setError(getUserFacingErrorMessage(loadError, 'Unable to load notifications'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useLiveEvents({
    onNotification: () => {
      void loadNotifications();
    },
    onError: (message) => {
      setError(message);
    },
  });

  const markAllRead = useCallback(async () => {
    await notificationService.markAllRead();
    await loadNotifications();
  }, [loadNotifications]);

  return {
    notifications,
    isLoading,
    error,
    markAllRead,
  };
}
