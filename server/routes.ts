import type { Express, Request, Response } from 'express';
import { db } from './db';
import { getAuthUser } from './services/authService';
import { registerAgentRoutes } from './routeModules/agentRoutes';
import { registerAuthRoutes } from './routeModules/authRoutes';
import { registerCommunicationRoutes } from './routeModules/communicationRoutes';
import { registerCustomSkillRoutes } from './routeModules/customSkillRoutes';
import { registerIntegrationRoutes } from './routeModules/integrationRoutes';
import { registerJobRoutes } from './routeModules/jobRoutes';
import { registerLiveSessionRoutes } from './routeModules/liveSessionRoutes';
import { registerMemoryRoutes } from './routeModules/memoryRoutes';
import { registerNotificationRoutes } from './routeModules/notificationRoutes';
import { registerTelegramRoutes } from './routeModules/telegramRoutes';
import { registerWorkspaceRoutes } from './routeModules/workspaceRoutes';
import type { AuthUserRecord } from './types';

function requireAuth(req: Request, res: Response): AuthUserRecord | null {
  const authHeader = req.headers.authorization ?? '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const queryToken = typeof req.query.authToken === 'string' ? req.query.authToken : '';
  const token = headerToken || queryToken;
  const user = token ? getAuthUser(token) : null;

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
  registerJobRoutes(app, requireAuth);
  registerCommunicationRoutes(app, requireAuth);
  registerTelegramRoutes(app);
  registerMemoryRoutes(app, requireAuth);
  registerLiveSessionRoutes(app, requireAuth);
  registerAgentRoutes(app, requireAuth);
  registerCustomSkillRoutes(app, requireAuth);
}
