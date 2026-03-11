/**
 * Notification Preferences Service — Phase 15
 *
 * Stores per-user notification delivery preferences:
 *   - slackWebhookUrl:    Slack Incoming Webhook URL (optional)
 *   - notifyOnSuccess:    fire notification when task completes
 *   - notifyOnError:      fire notification when task fails
 *   - digest:             not yet implemented (Phase 16)
 */
import { db } from '../db';
import { decryptJson, encryptJson } from './secretVault';

db.exec(`
  CREATE TABLE IF NOT EXISTS notification_prefs (
    user_id TEXT PRIMARY KEY,
    slack_webhook_url TEXT,
    slack_channel_name TEXT,
    notify_on_success INTEGER NOT NULL DEFAULT 1,
    notify_on_error INTEGER NOT NULL DEFAULT 1,
    in_app_enabled INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  )
`);

export interface NotificationPrefs {
    userId: string;
    slackWebhookUrl?: string;
    slackChannelName?: string;
    notifyOnSuccess: boolean;
    notifyOnError: boolean;
    inAppEnabled: boolean;
    updatedAt: string;
}

const DEFAULTS: Omit<NotificationPrefs, 'userId' | 'updatedAt'> = {
    notifyOnSuccess: true,
    notifyOnError: true,
    inAppEnabled: true,
};

function decodeSlackWebhookUrl(rawValue: unknown): string | undefined {
    if (!rawValue) {
        return undefined;
    }

    const value = String(rawValue);

    try {
        return decryptJson(value).slackWebhookUrl;
    } catch {
        return value;
    }
}

function encodeSlackWebhookUrl(value: string | undefined): string | null {
    if (!value) {
        return null;
    }

    try {
        return encryptJson({ slackWebhookUrl: value });
    } catch {
        return value;
    }
}

function rowToPrefs(row: Record<string, unknown>): NotificationPrefs {
    return {
        userId: String(row.user_id),
        slackWebhookUrl: decodeSlackWebhookUrl(row.slack_webhook_url),
        slackChannelName: row.slack_channel_name ? String(row.slack_channel_name) : undefined,
        notifyOnSuccess: Boolean(row.notify_on_success),
        notifyOnError: Boolean(row.notify_on_error),
        inAppEnabled: Boolean(row.in_app_enabled),
        updatedAt: String(row.updated_at),
    };
}

export function getNotificationPrefs(userId: string): NotificationPrefs {
    const row = db.prepare('SELECT * FROM notification_prefs WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
    if (!row) {
        return { ...DEFAULTS, userId, updatedAt: new Date().toISOString() };
    }
    return rowToPrefs(row);
}

export function saveNotificationPrefs(userId: string, prefs: Partial<Omit<NotificationPrefs, 'userId' | 'updatedAt'>>): NotificationPrefs {
    const current = getNotificationPrefs(userId);
    const merged = { ...current, ...prefs };
    const now = new Date().toISOString();

    db.prepare(`
        INSERT INTO notification_prefs (user_id, slack_webhook_url, slack_channel_name, notify_on_success, notify_on_error, in_app_enabled, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            slack_webhook_url = excluded.slack_webhook_url,
            slack_channel_name = excluded.slack_channel_name,
            notify_on_success = excluded.notify_on_success,
            notify_on_error = excluded.notify_on_error,
            in_app_enabled = excluded.in_app_enabled,
            updated_at = excluded.updated_at
    `).run(
        userId,
        encodeSlackWebhookUrl(merged.slackWebhookUrl),
        merged.slackChannelName ?? null,
        merged.notifyOnSuccess ? 1 : 0,
        merged.notifyOnError ? 1 : 0,
        merged.inAppEnabled ? 1 : 0,
        now,
    );

    return getNotificationPrefs(userId);
}
