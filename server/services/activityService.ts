import {randomUUID} from 'node:crypto';
import {db} from '../db';
import {createNotification} from './notificationService';
import type {ActivityType, TaskRecord} from '../types';

function getTimestampLabel(): string {
  return new Date().toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
}

export function insertActivity(title: string, description: string, type: ActivityType): void {
  db.prepare(`
    INSERT INTO activities (id, title, description, time, type)
    VALUES (?, ?, ?, ?, ?)
  `).run(`ACT-${randomUUID()}`, title, description, getTimestampLabel(), type);

  createNotification({
    title,
    message: description,
    type: type === 'communication' ? 'info' : type === 'action' ? 'success' : 'default',
    sourcePath: type === 'communication' ? '/notifications' : '/activity',
  });
}

export function insertTask(title: string, tool: string, status: TaskRecord['status'] = 'completed'): void {
  db.prepare(`
    INSERT INTO tasks (id, title, status, time, tool_name, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(`TSK-${randomUUID()}`, title, status, getTimestampLabel(), tool, 'High');

  createNotification({
    title: status === 'completed' ? 'Task completed' : 'Task updated',
    message: `${title} (${tool})`,
    type: status === 'completed' ? 'success' : 'info',
    sourcePath: '/tasks',
  });
}
