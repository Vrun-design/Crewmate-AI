import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB dependency before importing notificationPrefsService
vi.mock('../db', () => ({
    db: {
        exec: vi.fn(),
        prepare: vi.fn(() => ({
            get: vi.fn(),
            run: vi.fn(),
        })),
    },
}));

import { db } from '../db';
import { getNotificationPrefs, saveNotificationPrefs } from './notificationPrefsService';

const userId = 'user-prefs-test';

describe('notificationPrefsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns defaults when no prefs are stored', () => {
        (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: vi.fn().mockReturnValue(undefined), run: vi.fn() });
        const prefs = getNotificationPrefs(userId);
        expect(prefs.userId).toBe(userId);
        expect(prefs.notifyOnSuccess).toBe(true);
        expect(prefs.notifyOnError).toBe(true);
        expect(prefs.inAppEnabled).toBe(true);
        expect(prefs.slackWebhookUrl).toBeUndefined();
    });

    it('returns stored prefs when a row exists', () => {
        const row = {
            user_id: userId,
            slack_webhook_url: 'https://hooks.slack.com/test',
            slack_channel_name: '#crew',
            notify_on_success: 1,
            notify_on_error: 0,
            in_app_enabled: 1,
            updated_at: '2026-01-01T00:00:00.000Z',
        };
        (db.prepare as ReturnType<typeof vi.fn>).mockReturnValue({ get: vi.fn().mockReturnValue(row), run: vi.fn() });
        const prefs = getNotificationPrefs(userId);
        expect(prefs.slackWebhookUrl).toBe('https://hooks.slack.com/test');
        expect(prefs.notifyOnError).toBe(false);
        expect(prefs.inAppEnabled).toBe(true);
    });

    it('saves partial prefs merged over defaults', () => {
        const mockRun = vi.fn();
        (db.prepare as ReturnType<typeof vi.fn>)
            .mockReturnValueOnce({ get: vi.fn().mockReturnValue(undefined) }) // getNotificationPrefs (current)
            .mockReturnValueOnce({ run: mockRun })                            // INSERT/UPDATE
            .mockReturnValueOnce({
                get: vi.fn().mockReturnValue({              // getNotificationPrefs (return)
                    user_id: userId,
                    slack_webhook_url: 'https://hooks.slack.com/x',
                    slack_channel_name: null,
                    notify_on_success: 1,
                    notify_on_error: 1,
                    in_app_enabled: 1,
                    updated_at: new Date().toISOString(),
                })
            });

        const result = saveNotificationPrefs(userId, { slackWebhookUrl: 'https://hooks.slack.com/x' });
        expect(mockRun).toHaveBeenCalledOnce();
        expect(result.slackWebhookUrl).toBe('https://hooks.slack.com/x');
    });

    it('disabling a toggle is persisted', () => {
        const mockRun = vi.fn();
        (db.prepare as ReturnType<typeof vi.fn>)
            .mockReturnValueOnce({ get: vi.fn().mockReturnValue(undefined) })
            .mockReturnValueOnce({ run: mockRun })
            .mockReturnValueOnce({
                get: vi.fn().mockReturnValue({
                    user_id: userId,
                    slack_webhook_url: null,
                    slack_channel_name: null,
                    notify_on_success: 0,
                    notify_on_error: 1,
                    in_app_enabled: 1,
                    updated_at: new Date().toISOString(),
                })
            });

        const result = saveNotificationPrefs(userId, { notifyOnSuccess: false });
        expect(result.notifyOnSuccess).toBe(false);
    });
});
