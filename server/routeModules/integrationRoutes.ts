import type { Express, Request, Response } from 'express';
import {
    deleteIntegrationConfig,
    getIntegrationConfigState,
    saveIntegrationConfig,
} from '../services/integrationConfigService';
import { listIntegrationCatalog } from '../services/integrationCatalog';
import {
    createGoogleWorkspaceConnectUrl,
    deleteGoogleWorkspaceConfig,
    finalizeGoogleWorkspaceOAuthCallback,
    getGoogleWorkspaceConfigState,
    saveGoogleWorkspaceDefaults,
} from '../services/googleWorkspaceService';
import {
    createSlackConnectUrl,
    deleteSlackConfig,
    finalizeSlackOAuthCallback,
    getSlackConfigState,
    saveSlackDefaults,
} from '../services/slackService';
import {
    createNotionConnectUrl,
    deleteNotionConfig,
    finalizeNotionOAuthCallback,
    getNotionConfigState,
    saveNotionDefaults,
} from '../services/notionService';
import {
    createClickUpConnectUrl,
    deleteClickUpConfig,
    finalizeClickUpOAuthCallback,
    getClickUpConfigState,
    saveClickUpDefaults,
} from '../services/clickupService';
import type { RequireAuth } from './types';

function isOAuthConfigIntegration(integrationId: string): boolean {
    return integrationId === 'google-workspace'
        || integrationId === 'slack'
        || integrationId === 'notion'
        || integrationId === 'clickup';
}

function wantsJsonRedirect(req: Request): boolean {
    return req.query.responseMode === 'json';
}

function respondWithRedirect(req: Request, res: Response, redirectUrl: string): void {
    if (wantsJsonRedirect(req)) {
        res.json({ redirectUrl });
        return;
    }

    res.redirect(302, redirectUrl);
}

export function registerIntegrationRoutes(app: Express, requireAuth: RequireAuth): void {
    app.get('/api/integrations', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        res.json(listIntegrationCatalog(user.workspaceId, user.id));
    });

    app.get('/api/integrations/:integrationId/config', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        if (req.params.integrationId === 'google-workspace') {
            res.json(getGoogleWorkspaceConfigState(user.workspaceId));
            return;
        }
        if (req.params.integrationId === 'slack') {
            res.json(getSlackConfigState(user.workspaceId));
            return;
        }
        if (req.params.integrationId === 'notion') {
            res.json(getNotionConfigState(user.workspaceId));
            return;
        }
        if (req.params.integrationId === 'clickup') {
            res.json(getClickUpConfigState(user.workspaceId));
            return;
        }
        res.json(getIntegrationConfigState(user.workspaceId, req.params.integrationId));
    });

    app.put('/api/integrations/:integrationId/config', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        try {
            if (req.params.integrationId === 'google-workspace') {
                res.json(saveGoogleWorkspaceDefaults(user.workspaceId, req.body?.values ?? {}));
                return;
            }
            if (req.params.integrationId === 'slack') {
                res.json(saveSlackDefaults(user.workspaceId, req.body?.values ?? {}));
                return;
            }
            if (req.params.integrationId === 'notion') {
                res.json(saveNotionDefaults(user.workspaceId, req.body?.values ?? {}));
                return;
            }
            if (req.params.integrationId === 'clickup') {
                res.json(saveClickUpDefaults(user.workspaceId, req.body?.values ?? {}));
                return;
            }
            res.json(saveIntegrationConfig(user.workspaceId, req.params.integrationId, req.body?.values ?? {}));
        } catch (err: unknown) {
            res.status(400).json({ message: err instanceof Error ? err.message : 'Invalid configuration' });
        }
    });

    app.delete('/api/integrations/:integrationId/config', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        if (req.params.integrationId === 'google-workspace') {
            deleteGoogleWorkspaceConfig(user.workspaceId);
            res.json({ success: true });
            return;
        }
        if (req.params.integrationId === 'slack') {
            deleteSlackConfig(user.workspaceId);
            res.json({ success: true });
            return;
        }
        if (req.params.integrationId === 'notion') {
            deleteNotionConfig(user.workspaceId);
            res.json({ success: true });
            return;
        }
        if (req.params.integrationId === 'clickup') {
            deleteClickUpConfig(user.workspaceId);
            res.json({ success: true });
            return;
        }
        deleteIntegrationConfig(user.workspaceId, req.params.integrationId);
        res.json({ success: true });
    });

    app.get('/api/integrations/google-workspace/connect', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        try {
            const redirectUrl = createGoogleWorkspaceConnectUrl({
                workspaceId: user.workspaceId,
                userId: user.id,
                redirectPath: typeof req.query.redirectPath === 'string' ? req.query.redirectPath : '/integrations',
            });
            respondWithRedirect(req, res, redirectUrl);
        } catch (err: unknown) {
            res.status(400).json({ message: err instanceof Error ? err.message : 'Unable to start Google Workspace connection' });
        }
    });

    app.get('/api/integrations/google-workspace/callback', async (req: Request, res: Response) => {
        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        if (!code || !state) {
            res.status(400).json({ message: 'Missing Google OAuth callback parameters.' });
            return;
        }

        try {
            const result = await finalizeGoogleWorkspaceOAuthCallback({ code, state });
            res.redirect(302, result.redirectUrl);
        } catch (err: unknown) {
            res.status(400).json({ message: err instanceof Error ? err.message : 'Unable to complete Google Workspace connection' });
        }
    });

    app.get('/api/integrations/:integrationId/connect', (req: Request, res: Response) => {
        const integrationId = req.params.integrationId;
        if (!isOAuthConfigIntegration(integrationId) || integrationId === 'google-workspace') {
            res.status(404).json({ message: 'Unknown integration connect route.' });
            return;
        }

        const user = requireAuth(req, res);
        if (!user) return;

        try {
            let redirectUrl = '';
            if (integrationId === 'slack') {
                redirectUrl = createSlackConnectUrl({
                    workspaceId: user.workspaceId,
                    userId: user.id,
                    redirectPath: typeof req.query.redirectPath === 'string' ? req.query.redirectPath : '/integrations',
                });
            } else if (integrationId === 'notion') {
                redirectUrl = createNotionConnectUrl({
                    workspaceId: user.workspaceId,
                    userId: user.id,
                    redirectPath: typeof req.query.redirectPath === 'string' ? req.query.redirectPath : '/integrations',
                });
            } else if (integrationId === 'clickup') {
                redirectUrl = createClickUpConnectUrl({
                    workspaceId: user.workspaceId,
                    userId: user.id,
                    redirectPath: typeof req.query.redirectPath === 'string' ? req.query.redirectPath : '/integrations',
                });
            }

            respondWithRedirect(req, res, redirectUrl);
        } catch (err: unknown) {
            res.status(400).json({ message: err instanceof Error ? err.message : `Unable to start ${integrationId} connection` });
        }
    });

    app.get('/api/integrations/:integrationId/callback', async (req: Request, res: Response) => {
        const integrationId = req.params.integrationId;
        if (!isOAuthConfigIntegration(integrationId) || integrationId === 'google-workspace') {
            res.status(404).json({ message: 'Unknown integration callback route.' });
            return;
        }

        const code = typeof req.query.code === 'string' ? req.query.code : '';
        const state = typeof req.query.state === 'string' ? req.query.state : '';
        if (!code || !state) {
            res.status(400).json({ message: 'Missing OAuth callback parameters.' });
            return;
        }

        try {
            let redirectUrl = '';
            if (integrationId === 'slack') {
                redirectUrl = await finalizeSlackOAuthCallback({ code, state });
            } else if (integrationId === 'notion') {
                redirectUrl = await finalizeNotionOAuthCallback({ code, state });
            } else if (integrationId === 'clickup') {
                redirectUrl = await finalizeClickUpOAuthCallback({ code, state });
            }
            res.redirect(302, redirectUrl);
        } catch (err: unknown) {
            res.status(400).json({ message: err instanceof Error ? err.message : `Unable to complete ${integrationId} connection` });
        }
    });
}
