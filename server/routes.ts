import type {Express, Request, Response} from 'express';
import {getDashboardPayload} from './repositories/dashboardRepository';
import {listActivities, listSessionHistory, listTasks} from './repositories/workspaceRepository';
import {clearAuthSession, getAuthUser, requestLoginCode, verifyLoginCode} from './services/authService';
import {listCapabilities} from './services/capabilityService';
import {generateCreativeArtifact} from './services/creativeStudioService';
import {enqueueResearchBriefJob, listJobs} from './services/delegationService';
import {
  deleteIntegrationConfig,
  getIntegrationConfigState,
  saveIntegrationConfig,
} from './services/integrationConfigService';
import {listIntegrationCatalog} from './services/integrationCatalog';
import {ingestMemoryNode, listMemoryNodes} from './services/memoryService';
import {listNotifications, markAllNotificationsRead} from './services/notificationService';
import {getUserPreferences, saveUserPreferences} from './services/preferencesService';
import {endSession, startSession} from './services/sessionService';
import {
  endGeminiLiveSession,
  getLiveAudioChunks,
  getLiveSessionState,
  endLiveAudioInput,
  sendLiveAudioChunk,
  sendLiveMessage,
  sendLiveVideoFrame,
  startGeminiLiveSession,
} from './services/liveGateway';
import type {AuthUserRecord, UserPreferencesRecord} from './types';

function requireAuth(req: Request, res: Response): AuthUserRecord | null {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const user = token ? getAuthUser(token) : null;

  if (!user) {
    res.status(401).json({message: 'Unauthorized'});
    return null;
  }

  return user;
}

export function registerRoutes(app: Express) {
  app.post('/api/auth/request-code', (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email) {
      res.status(400).json({message: 'email is required'});
      return;
    }

    res.status(201).json(requestLoginCode(email));
  });

  app.post('/api/auth/verify', (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

    if (!email || !code) {
      res.status(400).json({message: 'email and code are required'});
      return;
    }

    try {
      res.json(verifyLoginCode(email, code));
    } catch (error) {
      res.status(401).json({message: error instanceof Error ? error.message : 'Verification failed'});
    }
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const user = token ? getAuthUser(token) : null;

    if (!user) {
      res.status(401).json({message: 'Unauthorized'});
      return;
    }

    res.json(user);
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token) {
      clearAuthSession(token);
    }
    res.status(204).send();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ok: true});
  });

  app.get('/api/dashboard', (_req: Request, res: Response) => {
    const user = requireAuth(_req, res);
    if (!user) return;
    res.json(getDashboardPayload(user.id));
  });

  app.get('/api/integrations', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listIntegrationCatalog(user.id));
  });

  app.get('/api/integrations/:integrationId/config', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getIntegrationConfigState(user.id, req.params.integrationId));
  });

  app.put('/api/integrations/:integrationId/config', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      res.json(saveIntegrationConfig(user.id, req.params.integrationId, req.body?.values ?? {}));
    } catch (error) {
      res.status(400).json({message: error instanceof Error ? error.message : 'Unable to save integration config'});
    }
  });

  app.delete('/api/integrations/:integrationId/config', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    deleteIntegrationConfig(user.id, req.params.integrationId);
    res.status(204).send();
  });

  app.get('/api/tasks', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listTasks());
  });

  app.get('/api/activities', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listActivities());
  });

  app.get('/api/sessions/history', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listSessionHistory());
  });

  app.get('/api/notifications', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listNotifications());
  });

  app.post('/api/notifications/read-all', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    markAllNotificationsRead();
    res.status(204).send();
  });

  app.get('/api/capabilities', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listCapabilities(user.id));
  });

  app.get('/api/jobs', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listJobs(user.id));
  });

  app.post('/api/jobs/research-brief', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    const goal = typeof req.body?.goal === 'string' ? req.body.goal.trim() : '';
    const audience = typeof req.body?.audience === 'string' ? req.body.audience.trim() : 'team';

    if (!topic || !goal) {
      res.status(400).json({message: 'topic and goal are required'});
      return;
    }

    res.status(201).json(
      enqueueResearchBriefJob(user.id, {
        topic,
        goal,
        audience,
        deliverToNotion: Boolean(req.body?.deliverToNotion),
        notifyInSlack: Boolean(req.body?.notifyInSlack),
      }),
    );
  });

  app.post('/api/creative/generate', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const context = typeof req.body?.context === 'string' ? req.body.context.trim() : '';
    const outputStyle = typeof req.body?.outputStyle === 'string' ? req.body.outputStyle.trim() : '';

    if (!prompt) {
      res.status(400).json({message: 'prompt is required'});
      return;
    }

    try {
      res.json(await generateCreativeArtifact(user.id, {prompt, context, outputStyle}));
    } catch (error) {
      res.status(500).json({message: error instanceof Error ? error.message : 'Creative generation failed'});
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

  app.post('/api/sessions', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.status(201).json(startSession(user.id));
  });

  app.post('/api/sessions/live', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      const baseSession = startSession(user.id, {seedTranscript: false, provider: 'gemini-live'});
      const liveSession = await startGeminiLiveSession(baseSession.id);
      res.status(201).json(liveSession);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unable to start Gemini Live session',
      });
    }
  });

  app.get('/api/sessions/:sessionId', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const session = getLiveSessionState(req.params.sessionId);
    if (!session) {
      res.status(404).json({message: 'Session not found'});
      return;
    }

    res.json(session);
  });

  app.get('/api/sessions/:sessionId/audio-chunks', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const after = Number.parseInt(String(req.query.after ?? '0'), 10);
    const audioChunks = getLiveAudioChunks(req.params.sessionId, Number.isNaN(after) ? 0 : after);
    res.json(audioChunks);
  });

  app.post('/api/sessions/:sessionId/messages', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

    if (!text) {
      res.status(400).json({message: 'text is required'});
      return;
    }

    try {
      const session = await sendLiveMessage(req.params.sessionId, text);
      res.json(session);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unable to send live message',
      });
    }
  });

  app.post('/api/sessions/:sessionId/frame', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim() : '';
    const data = typeof req.body?.data === 'string' ? req.body.data.trim() : '';

    if (!mimeType || !data) {
      res.status(400).json({message: 'mimeType and data are required'});
      return;
    }

    try {
      sendLiveVideoFrame(req.params.sessionId, {mimeType, data});
      res.status(202).json({ok: true});
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unable to send live frame',
      });
    }
  });

  app.post('/api/sessions/:sessionId/audio', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim() : '';
    const data = typeof req.body?.data === 'string' ? req.body.data.trim() : '';

    if (!mimeType || !data) {
      res.status(400).json({message: 'mimeType and data are required'});
      return;
    }

    try {
      sendLiveAudioChunk(req.params.sessionId, {mimeType, data});
      res.status(202).json({ok: true});
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unable to send live audio chunk',
      });
    }
  });

  app.post('/api/sessions/:sessionId/audio/end', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    try {
      endLiveAudioInput(req.params.sessionId);
      res.status(202).json({ok: true});
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unable to end live audio stream',
      });
    }
  });

  app.post('/api/sessions/:sessionId/end', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const session = endGeminiLiveSession(req.params.sessionId) ?? endSession(req.params.sessionId);

    if (!session) {
      res.status(404).json({message: 'Session not found'});
      return;
    }

    res.json(session);
  });

  app.get('/api/memory/nodes', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listMemoryNodes());
  });

  app.post('/api/memory/ingest', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const type = typeof req.body?.type === 'string' ? req.body.type : 'document';

    if (!title) {
      res.status(400).json({message: 'title is required'});
      return;
    }

    const id = ingestMemoryNode({
      title,
      type: ['document', 'preference', 'integration', 'core'].includes(type) ? type : 'document',
    });

    res.status(201).json({id});
  });
}
