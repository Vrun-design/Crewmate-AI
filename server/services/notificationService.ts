import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { broadcastEvent } from './eventService';
import type { NotificationRecord } from '../types';

function getTimestampLabel(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function createNotification(userId: string, input: {
  title: string;
  message: string;
  type: NotificationRecord['type'];
  sourcePath?: string;
}): void {
  const id = `NTF-${randomUUID()}`;
  db.prepare(`
    INSERT INTO notifications (id, user_id, title, message, time, type, read, source_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    id,
    userId,
    input.title,
    input.message,
    getTimestampLabel(),
    input.type,
    input.sourcePath ?? null,
    new Date().toISOString(),
  );

  broadcastEvent(userId, 'notification', { id, ...input });
}

export function listNotifications(userId: string): NotificationRecord[] {
  return db.prepare(`
    SELECT id, title, message, time, type, read, source_path as sourcePath
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId).map((row) => ({
    ...row,
    read: Boolean((row as { read: number }).read),
  })) as NotificationRecord[];
}

export function markAllNotificationsRead(userId: string): void {
  db.prepare(`
    UPDATE notifications
    SET read = 1
    WHERE user_id = ?
  `).run(userId);
}
