import {randomUUID} from 'node:crypto';
import {db} from '../db';
import type {NotificationRecord} from '../types';

function getTimestampLabel(): string {
  return new Date().toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
}

export function createNotification(input: {
  title: string;
  message: string;
  type: NotificationRecord['type'];
  sourcePath?: string;
}): void {
  db.prepare(`
    INSERT INTO notifications (id, title, message, time, type, read, source_path, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    `NTF-${randomUUID()}`,
    input.title,
    input.message,
    getTimestampLabel(),
    input.type,
    input.sourcePath ?? null,
    new Date().toISOString(),
  );
}

export function listNotifications(): NotificationRecord[] {
  return db.prepare(`
    SELECT id, title, message, time, type, read, source_path as sourcePath
    FROM notifications
    ORDER BY created_at DESC
  `).all().map((row) => ({
    ...row,
    read: Boolean((row as {read: number}).read),
  })) as NotificationRecord[];
}

export function markAllNotificationsRead(): void {
  db.prepare(`
    UPDATE notifications
    SET read = 1
  `).run();
}
