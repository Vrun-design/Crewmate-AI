import type { Express, Request, Response } from 'express';
import {
    deleteIntegrationConfig,
    getIntegrationConfigState,
    saveIntegrationConfig,
} from '../services/integrationConfigService';
import { listIntegrationCatalog } from '../services/integrationCatalog';
import { buildCalendarAuthUrl, exchangeCalendarCode } from '../services/calendarService';
import { buildGmailAuthUrl, exchangeGmailCode, isGmailConfigured, readGmailInbox } from '../services/gmailService';
import type { RequireAuth } from './types';

export function registerIntegrationRoutes(app: Express, requireAuth: RequireAuth): void {
    app.get('/api/integrations', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        res.json(listIntegrationCatalog(user.workspaceId, user.id));
    });

    app.get('/api/integrations/:integrationId/config', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        res.json(getIntegrationConfigState(user.workspaceId, req.params.integrationId));
    });

    app.put('/api/integrations/:integrationId/config', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        try {
            res.json(saveIntegrationConfig(user.workspaceId, req.params.integrationId, req.body?.values ?? {}));
        } catch (err: unknown) {
            res.status(400).json({ message: err instanceof Error ? err.message : 'Invalid configuration' });
        }
    });

    app.delete('/api/integrations/:integrationId/config', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        deleteIntegrationConfig(user.workspaceId, req.params.integrationId);
        res.json({ success: true });
    });

    // Gmail OAuth
    app.get('/api/auth/gmail', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        res.redirect(buildGmailAuthUrl(user.workspaceId));
    });

    app.get('/api/auth/gmail/callback', async (req: Request, res: Response) => {
        const code = String(req.query.code ?? '');
        const state = String(req.query.state ?? '');
        if (!code) { res.status(400).send('Missing code'); return; }
        try {
            await exchangeGmailCode(state, code);
            res.redirect('/?integration=gmail&status=connected');
        } catch (err) {
            res.status(500).send(`Gmail OAuth failed: ${String(err)}`);
        }
    });

    app.get('/api/gmail/inbox', async (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        const maxResults = Number.parseInt(String(req.query.maxResults ?? '5'), 10);

        if (!isGmailConfigured(user.workspaceId)) {
            res.json({ isConnected: false, messages: [] });
            return;
        }

        try {
            const messages = await readGmailInbox(user.workspaceId, { maxResults });
            res.json({ isConnected: true, messages });
        } catch (err) {
            console.error('[Gmail inbox]', err);
            res.json({ isConnected: true, messages: [], error: String(err) });
        }
    });

    // Calendar OAuth
    app.get('/api/auth/calendar', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        res.redirect(buildCalendarAuthUrl(user.workspaceId));
    });

    app.get('/api/auth/calendar/callback', async (req: Request, res: Response) => {
        const code = String(req.query.code ?? '');
        const state = String(req.query.state ?? '');
        if (!code) { res.status(400).send('Missing code'); return; }
        try {
            await exchangeCalendarCode(state, code);
            res.redirect('/?integration=calendar&status=connected');
        } catch (err) {
            res.status(500).send(`Calendar OAuth failed: ${String(err)}`);
        }
    });
}
