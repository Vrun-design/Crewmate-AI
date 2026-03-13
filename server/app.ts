import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { serverConfig } from './config';
import './db';
import { registerRoutes } from './routes';
import { resolveAuthUserFromToken } from './services/authService';
import { withRequestContext } from './services/requestContext';

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const requestId = req.header('x-request-id')?.trim() || randomUUID();
    res.setHeader('x-request-id', requestId);
    withRequestContext({ requestId }, next);
  });

  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  }));

  app.use(
    cors({
      origin: serverConfig.isProduction ? serverConfig.publicWebAppUrl : serverConfig.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: serverConfig.requestBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: serverConfig.requestBodyLimit }));

  app.get('/api/health/live', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/health/ready', (_req, res) => {
    res.json({
      ok: true,
      env: serverConfig.appEnv,
      firebaseAuthEnabled: Boolean(serverConfig.firebaseProjectId.trim()),
    });
  });

  app.use(async (req, _res, next) => {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    (req as express.Request & { authUser?: unknown }).authUser = token ? await resolveAuthUserFromToken(token) : null;
    next();
  });

  registerRoutes(app);

  return app;
}
