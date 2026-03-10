import cors from 'cors';
import express from 'express';
import { serverConfig } from './config';
import './db';
import { registerMcpRoutes } from './mcp/mcpRoutes';
import { registerRoutes } from './routes';

export function createApp(): express.Express {
  const app = express();

  app.use(
    cors({
      origin: serverConfig.corsOrigin,
    }),
  );
  app.use(express.json({ limit: serverConfig.requestBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: serverConfig.requestBodyLimit }));

  registerRoutes(app);
  registerMcpRoutes(app);

  return app;
}
