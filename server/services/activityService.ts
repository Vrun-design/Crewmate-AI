import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { createNotification } from './notificationService';
import type { ActivityType, TaskRecord } from '../types';

export const SYSTEM_USER_ID = '__system__';

function getTimestampLabel(): string {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function insertActivity(title: string, description: string, type: ActivityType, userId = SYSTEM_USER_ID): void {
  db.prepare(`
    INSERT INTO activities (id, user_id, title, description, time, type)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`ACT-${randomUUID()}`, userId, title, description, getTimestampLabel(), type);

  createNotification(userId, {
    title,
    message: description,
    type: type === 'communication' ? 'info' : type === 'action' ? 'success' : 'default',
    sourcePath: type === 'communication' ? '/notifications' : '/activity',
  });
}

export function insertTask(title: string, tool: string, status: TaskRecord['status'] = 'completed', userId = SYSTEM_USER_ID): void {
  db.prepare(`
    INSERT INTO tasks (id, user_id, title, status, time, tool_name, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(`TSK-${randomUUID()}`, userId, title, status, getTimestampLabel(), tool, 'High');

  createNotification(userId, {
    title: status === 'completed' ? 'Task completed' : 'Task updated',
    message: `${title} (${tool})`,
    type: status === 'completed' ? 'success' : 'info',
    sourcePath: '/tasks',
  });
}
