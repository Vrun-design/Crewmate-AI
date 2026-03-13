import type { Express, Request, Response } from 'express';
import { db } from './db';
import { registerAgentRoutes } from './routeModules/agentRoutes';
import { registerAuthRoutes } from './routeModules/authRoutes';
import { registerCommunicationRoutes } from './routeModules/communicationRoutes';
import { registerIntegrationRoutes } from './routeModules/integrationRoutes';
import { registerLiveSessionRoutes } from './routeModules/liveSessionRoutes';
import { registerMemoryRoutes } from './routeModules/memoryRoutes';
import { registerNotificationRoutes } from './routeModules/notificationRoutes';
import { registerWorkspaceRoutes } from './routeModules/workspaceRoutes';
import type { AuthUserRecord } from './types';

function requireAuth(req: Request, res: Response): AuthUserRecord | null {
  const user = (req as Request & { authUser?: AuthUserRecord | null }).authUser ?? null;

  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  return user;
}

export function registerRoutes(app: Express) {
  registerAuthRoutes(app);
  registerWorkspaceRoutes(app, requireAuth);
  registerNotificationRoutes(app, requireAuth);
  registerIntegrationRoutes(app, requireAuth);
  registerCommunicationRoutes(app, requireAuth);
  registerMemoryRoutes(app, requireAuth);
  registerLiveSessionRoutes(app, requireAuth);
  registerAgentRoutes(app, requireAuth);
}
