import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { getDashboardPayload } from '../repositories/dashboardRepository';
import { listActivities, listSessionHistory, listTasks } from '../repositories/workspaceRepository';
import { listCapabilities } from '../services/capabilityService';
import { generateCreativeArtifact } from '../services/creativeStudioService';
import { addSseClient } from '../services/eventService';
import { getActivePersona, listPersonas, setActivePersona } from '../services/personaService';
import { getOnboardingProfile, saveOnboardingProfile } from '../services/onboardingProfileService';
import { getUserPreferences, saveUserPreferences } from '../services/preferencesService';
import { getFeatureFlags } from '../services/featureFlagService';
import type { UserPreferencesRecord } from '../types';
import type { RequireAuth } from './types';

export function registerWorkspaceRoutes(app: Express, requireAuth: RequireAuth): void {
  app.get('/api/health', (_req: Request, res: Response) => {
    try {
      const dbOk = Boolean(db.prepare('SELECT 1').get());
      const { ALL_SKILLS } = require('../skills/index') as typeof import('../skills/index');
      res.json({
        ok: dbOk,
        service: 'crewmate',
        version: process.env.npm_package_version ?? '0.1.0',
        uptime: Math.floor(process.uptime()),
        skills: ALL_SKILLS?.length ?? 0,
        env: process.env.NODE_ENV ?? 'development',
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  app.get('/api/audit', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
    try {
      const { listAuditLog } = require('../services/auditLogger') as typeof import('../services/auditLogger');
      res.json(listAuditLog(limit, user.id));
    } catch {
      res.json([]);
    }
  });

  app.get('/api/events', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write('event: ping\ndata: "connected"\n\n');
    addSseClient(req.socket.remoteAddress + '-' + Date.now(), user.id, req, res);
  });

  app.get('/api/dashboard', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getDashboardPayload(user.workspaceId, user.id));
  });

  app.get('/api/tasks', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listTasks(user.id));
  });

  app.get('/api/activities', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listActivities(user.id));
  });

  app.get('/api/sessions/history', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listSessionHistory(user.id));
  });

  app.delete('/api/sessions/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { id } = req.params;
    db.prepare('DELETE FROM session_messages WHERE session_id = ?').run(id);
    const result = db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, user.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.status(204).send();
  });

  app.get('/api/capabilities', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listCapabilities(user.workspaceId, user.id));
  });

  app.get('/api/feature-flags', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getFeatureFlags());
  });

  app.post('/api/creative/generate', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const context = typeof req.body?.context === 'string' ? req.body.context.trim() : '';
    const outputStyle = typeof req.body?.outputStyle === 'string' ? req.body.outputStyle.trim() : '';

    if (!prompt) {
      res.status(400).json({ message: 'prompt is required' });
      return;
    }

    try {
      res.json(await generateCreativeArtifact(user.id, { prompt, context, outputStyle }));
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Creative generation failed' });
    }
  });

  app.get('/api/preferences', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getUserPreferences(user.id));
  });

  app.put('/api/preferences', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(saveUserPreferences(user.id, req.body as UserPreferencesRecord));
  });

  app.get('/api/onboarding/profile', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getOnboardingProfile(user.id));
  });

  app.put('/api/onboarding/profile', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const agentName = typeof req.body?.agentName === 'string' ? req.body.agentName.trim() : '';
    const voiceModel = typeof req.body?.voiceModel === 'string' ? req.body.voiceModel.trim() : '';

    if (!voiceModel) {
      res.status(400).json({ message: 'voiceModel is required' });
      return;
    }

    res.json(saveOnboardingProfile(user.id, { agentName, voiceModel }));
  });

  app.get('/api/personas', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const personas = listPersonas();
    const active = getActivePersona(user.id);
    res.json({ personas, activePersonaId: active.id });
  });

  app.put('/api/personas/active', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const personaId = typeof req.body?.personaId === 'string' ? req.body.personaId.trim() : '';

    if (!personaId) {
      res.status(400).json({ message: 'personaId is required' });
      return;
    }

    try {
      res.json(setActivePersona(user.id, personaId));
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : 'Invalid personaId' });
    }
  });
}
