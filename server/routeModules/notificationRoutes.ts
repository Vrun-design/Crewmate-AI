import type { Express, Request, Response } from 'express';
import { listNotifications, markAllNotificationsRead } from '../services/notificationService';
import { getNotificationPrefs, saveNotificationPrefs } from '../services/notificationPrefsService';
import { createErrorResponse, logServerError } from '../services/runtimeLogger';
import type { RequireAuth } from './types';

export function registerNotificationRoutes(app: Express, requireAuth: RequireAuth): void {
    app.get('/api/notifications', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        res.json(listNotifications(user.id));
    });

    app.post('/api/notifications/read-all', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        markAllNotificationsRead(user.id);
        res.status(204).send();
    });

    app.get('/api/notification-prefs', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        res.json(getNotificationPrefs(user.id));
    });

    app.patch('/api/notification-prefs', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;

        const { slackWebhookUrl, slackChannelName, notifyOnSuccess, notifyOnError, inAppEnabled } = req.body as {
            slackWebhookUrl?: string;
            slackChannelName?: string;
            notifyOnSuccess?: boolean;
            notifyOnError?: boolean;
            inAppEnabled?: boolean;
        };

        res.json(saveNotificationPrefs(user.id, {
            slackWebhookUrl: slackWebhookUrl !== undefined ? slackWebhookUrl.trim() || undefined : undefined,
            slackChannelName: slackChannelName !== undefined ? slackChannelName.trim() || undefined : undefined,
            ...(notifyOnSuccess !== undefined ? { notifyOnSuccess } : {}),
            ...(notifyOnError !== undefined ? { notifyOnError } : {}),
            ...(inAppEnabled !== undefined ? { inAppEnabled } : {}),
        }));
    });

    app.post('/api/notification-prefs/test', async (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;

        const prefs = getNotificationPrefs(user.id);
        if (!prefs.slackWebhookUrl) {
            const errorResponse = createErrorResponse('No Slack webhook URL configured', {
                code: 'missing_slack_webhook',
                retryable: false,
                status: 400,
            });
            res.status(errorResponse.status).json(errorResponse.body);
            return;
        }

        try {
            const response = await fetch(prefs.slackWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: "🎉 Crewmate is connected! You'll receive agent task notifications here." }),
                signal: AbortSignal.timeout(8000),
            });
            res.json({ success: response.ok, status: response.status });
        } catch (err) {
            logServerError('notification-prefs:test', err, { userId: user.id });
            const errorResponse = createErrorResponse('Unable to send Slack test notification right now.', {
                code: 'notification_test_failed',
                retryable: true,
            });
            res.status(errorResponse.status).json(errorResponse.body);
        }
    });
}
