/**
 * monitoringWorker.ts
 *
 * Background worker that polls Gmail (unread inbox) and Google Calendar
 * (events starting within 20 minutes) for all users with Google Workspace
 * connected, and creates in-app notifications.
 *
 * Runs every 5 minutes via server/index.ts.
 * Avoids duplicate notifications using in-memory tracking (resets on restart).
 */
import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { createNotification } from './notificationService';
import { isGoogleWorkspaceConfigured } from './googleWorkspaceService';
import { listCalendarEvents } from './calendarService';
import { searchGmailMessages } from './gmailService';
import { broadcastEvent } from './eventService';
import { logServerError } from './runtimeLogger';

// Calendar event IDs we've already notified about (in-memory, resets on restart)
const notifiedCalendarEventIds = new Set<string>();

// Last Gmail notification time per workspaceId — limit to once per 30 min
const lastGmailNotifyAt = new Map<string, number>();
const GMAIL_NOTIFY_INTERVAL_MS = 30 * 60 * 1000;

// How far ahead to look for calendar events (minutes)
const CALENDAR_LOOKAHEAD_MINUTES = 20;

interface WorkspaceUser {
  userId: string;
  workspaceId: string;
}

function getActiveWorkspaceUsers(): WorkspaceUser[] {
  try {
    return db.prepare(`
      SELECT user_id as userId, workspace_id as workspaceId
      FROM workspace_members
      ORDER BY user_id
    `).all() as WorkspaceUser[];
  } catch {
    return [];
  }
}

async function checkCalendarForUser(userId: string, workspaceId: string): Promise<void> {
  if (!isGoogleWorkspaceConfigured(workspaceId)) return;

  const now = new Date();
  const lookahead = new Date(now.getTime() + CALENDAR_LOOKAHEAD_MINUTES * 60 * 1000);

  try {
    const events = await listCalendarEvents(workspaceId, { timeMin: now.toISOString(), maxResults: 5 });

    for (const event of events) {
      if (!event.id || notifiedCalendarEventIds.has(event.id)) continue;

      const startTime = event.start?.dateTime ? new Date(event.start.dateTime) : null;
      if (!startTime || startTime > lookahead) continue;

      const minutesUntil = Math.max(0, Math.round((startTime.getTime() - now.getTime()) / 60_000));
      const title = event.summary ?? 'Untitled event';
      const message = minutesUntil <= 1
        ? `Starting now: ${title}`
        : `Starting in ${minutesUntil} min: ${title}`;

      const calendarNotifId = `NTF-${randomUUID()}`;
      createNotification(userId, { title: 'Upcoming Meeting', message, type: 'info' });
      broadcastEvent(userId, 'notification', { id: calendarNotifId, title: 'Upcoming Meeting', message, type: 'info' });
      notifiedCalendarEventIds.add(event.id);
    }
  } catch (err) {
    logServerError('monitoringWorker:calendar', err, { userId, workspaceId });
  }
}

async function checkGmailForUser(userId: string, workspaceId: string): Promise<void> {
  if (!isGoogleWorkspaceConfigured(workspaceId)) return;

  const last = lastGmailNotifyAt.get(workspaceId) ?? 0;
  if (Date.now() - last < GMAIL_NOTIFY_INTERVAL_MS) return;

  try {
    const messages = await searchGmailMessages(workspaceId, 'is:unread is:inbox newer_than:1d');
    lastGmailNotifyAt.set(workspaceId, Date.now());

    if (messages.length === 0) return;

    const count = messages.length;
    const message = `You have ${count} unread email${count > 1 ? 's' : ''} in your inbox.`;
    const gmailNotifId = `NTF-${randomUUID()}`;
    createNotification(userId, { title: 'Unread Emails', message, type: 'info' });
    broadcastEvent(userId, 'notification', { id: gmailNotifId, title: 'Unread Emails', message, type: 'info' });
  } catch (err) {
    logServerError('monitoringWorker:gmail', err, { userId, workspaceId });
  }
}

export async function runMonitoringPass(): Promise<void> {
  const users = getActiveWorkspaceUsers();
  if (users.length === 0) return;

  // Process each user; de-duplicate Gmail checks per workspace
  const gmailCheckedWorkspaces = new Set<string>();

  for (const { userId, workspaceId } of users) {
    const doGmail = !gmailCheckedWorkspaces.has(workspaceId);
    if (doGmail) gmailCheckedWorkspaces.add(workspaceId);

    await Promise.all([
      checkCalendarForUser(userId, workspaceId),
      doGmail ? checkGmailForUser(userId, workspaceId) : Promise.resolve(),
    ]);
  }
}
