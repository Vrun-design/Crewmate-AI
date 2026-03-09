import {api} from '../lib/api';
import type {Notification} from '../types';

export const notificationService = {
  getNotifications(): Promise<Notification[]> {
    return api.get('/api/notifications');
  },
  markAllRead(): Promise<void> {
    return api.post('/api/notifications/read-all');
  },
};
