import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  endGeminiLiveSession,
  endLiveAudioInput,
  getLiveAudioChunks,
  getLiveSessionState,
  sendLiveAudioChunk,
  sendLiveMessage,
  sendLiveVideoFrame,
  startGeminiLiveSession,
} from '../services/liveGateway';
import { serverConfig } from '../config';
import { getCurrentSessionForUser, getSession, getSessionUserId, insertTranscriptMessage, listTranscript, updateSessionStatus } from '../repositories/sessionRepository';
import { endSession, sendLocalSessionMessage, startSession } from '../services/sessionService';
import type { RequireAuth } from './types';
import { getUserPreferences } from '../services/preferencesService';
import { buildUserSystemInstruction } from '../services/liveGatewayPromptBuilder';
import { buildLiveConnectConfig } from '../services/liveGatewayConfig';
import { getSkillDeclarations } from '../skills/registry';
import { selectModel } from '../services/modelRouter';
import { executeLiveFunctionCalls } from '../services/liveGatewayToolRunner';
import { ingestLiveTurnMemory } from '../services/memoryService';
import { db } from '../db';
import {
  captureLatestLiveScreenshot,
  getPublicScreenshotArtifactFilePath,
  getScreenshotArtifactFilePathForUser,
  getScreenshotArtifactForUser,
  revokeScreenshotArtifactShare,
  saveScreenshotArtifact,
} from '../services/screenshotArtifactService';
import { createRateLimitMiddleware } from '../services/rateLimit';
import { generateAndSaveSessionSummary } from '../services/liveSessionSummaryService';

const liveSessionCreateLimiter = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many session start requests. Please try again in a moment.',
});
const liveSessionMessageLimiter = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many live session messages. Please slow down.',
});
const publicArtifactLimiter = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many screenshot requests. Please try again shortly.',
});

export function registerLiveSessionRoutes(app: Express, requireAuth: RequireAuth): void {
  app.get('/api/artifacts/screenshots/:artifactId/public', publicArtifactLimiter, (req: Request, res: Response) => {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      res.status(401).json({ message: 'Missing artifact token' });
      return;
    }

    const file = getPublicScreenshotArtifactFilePath(req.params.artifactId, token);
    if (!file) {
      res.status(404).json({ message: 'Screenshot artifact not found' });
      return;
    }

    res.setHeader('Content-Type', file.mimeType);
    res.sendFile(file.path, { headers: { 'Cache-Control': 'public, max-age=300' } });
  });

  app.get('/api/artifacts/screenshots/:artifactId', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const file = getScreenshotArtifactFilePathForUser(req.params.artifactId, user.id);
    if (!file) {
      res.status(404).json({ message: 'Screenshot artifact not found' });
      return;
    }

    res.setHeader('Content-Type', file.mimeType);
    res.sendFile(file.path, { headers: { 'Cache-Control': 'private, max-age=60' } });
  });

  app.post('/api/sessions', liveSessionCreateLimiter, (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.status(201).json(startSession(user.id));
  });

  app.post('/api/sessions/live', liveSessionCreateLimiter, async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    if (!serverConfig.geminiApiKey) {
      res.status(201).json(startSession(user.id, { provider: 'local' }));
      return;
    }

    try {
      const baseSession = startSession(user.id, { seedTranscript: false, provider: 'gemini-live' });
      const liveSession = await startGeminiLiveSession(baseSession.id);
      res.status(201).json(liveSession);
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unable to start Gemini Live session',
      });
    }
  });

  app.post('/api/sessions/live/direct', liveSessionCreateLimiter, async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
      const session = startSession(user.id, { seedTranscript: false, provider: 'gemini-live' });
      const preferences = getUserPreferences(user.id);
      const systemInstruction = await buildUserSystemInstruction(user.id, { liveFast: true });
      res.status(201).json({
        session,
        bootstrap: {
          model: selectModel('live'),
          config: buildLiveConnectConfig({
            systemInstruction,
            voiceName: preferences.voiceModel,
            functionDeclarations: getSkillDeclarations({ liveOnly: true }),
          }),
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unable to bootstrap direct Gemini Live session',
      });
    }
  });

  app.get('/api/sessions/current', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const session = getCurrentSessionForUser(user.id);
    if (session?.provider === 'gemini-live' && session.status === 'live' && !getLiveSessionState(session.id)) {
      updateSessionStatus(session.id, 'ended', new Date().toISOString());
      res.json(null);
      return;
    }

    res.json(session);
  });

  app.get('/api/sessions/:sessionId', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const session = getLiveSessionState(req.params.sessionId);
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    res.json(session);
  });

  app.get('/api/sessions/:sessionId/transcript', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const ownerId = getSessionUserId(req.params.sessionId);
    if (!ownerId || ownerId !== user.id) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    const messages = listTranscript(req.params.sessionId);
    res.json(messages);
  });

  app.get('/api/sessions/:sessionId/audio-chunks', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const after = Number.parseInt(String(req.query.after ?? '0'), 10);
    const audioChunks = getLiveAudioChunks(req.params.sessionId, Number.isNaN(after) ? 0 : after);
    res.json(audioChunks);
  });

  app.post('/api/sessions/:sessionId/messages', liveSessionMessageLimiter, async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      res.status(400).json({ message: 'text is required' });
      return;
    }

    try {
      const sessionRecord = getSession(req.params.sessionId);
      if (!sessionRecord) {
        res.status(404).json({ message: 'Session not found' });
        return;
      }

      const session = sessionRecord.provider === 'local'
        ? sendLocalSessionMessage(req.params.sessionId, text)
        : await sendLiveMessage(req.params.sessionId, text);
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
      res.status(400).json({ message: 'mimeType and data are required' });
      return;
    }

    try {
      const session = getSession(req.params.sessionId);
      if (session?.provider === 'local') {
        res.status(202).json({ ok: true });
        return;
      }

      sendLiveVideoFrame(req.params.sessionId, { mimeType, data });
      res.status(202).json({ ok: true });
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unable to send live frame',
      });
    }
  });

  app.post('/api/sessions/:sessionId/screenshot', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const ownerId = getSessionUserId(req.params.sessionId);
    if (!ownerId || ownerId !== user.id) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    try {
      const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim() : '';
      const data = typeof req.body?.data === 'string' ? req.body.data.trim() : '';
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const caption = typeof req.body?.caption === 'string' ? req.body.caption.trim() : '';

      const artifact = mimeType && data
        ? saveScreenshotArtifact({
            userId: user.id,
            workspaceId: user.workspaceId,
            sessionId: req.params.sessionId,
            mimeType,
            data,
            title: title || undefined,
            caption: caption || undefined,
          })
        : captureLatestLiveScreenshot({
            userId: user.id,
            workspaceId: user.workspaceId,
            sessionId: req.params.sessionId,
            title: title || undefined,
            caption: caption || undefined,
          });

      res.status(201).json(artifact);
    } catch (error) {
      res.status(400).json({
        message: error instanceof Error ? error.message : 'Unable to capture screenshot artifact',
      });
    }
  });

  app.get('/api/sessions/:sessionId/screenshot/latest', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const ownerId = getSessionUserId(req.params.sessionId);
    if (!ownerId || ownerId !== user.id) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    const artifactId = typeof req.query.artifactId === 'string' ? req.query.artifactId : '';
    const artifact = artifactId ? getScreenshotArtifactForUser(artifactId, user.id) : null;
    if (!artifact) {
      res.status(404).json({ message: 'Screenshot artifact not found' });
      return;
    }

    res.json(artifact);
  });

  app.post('/api/artifacts/screenshots/:artifactId/revoke', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const artifact = revokeScreenshotArtifactShare(req.params.artifactId, user.id);
    if (!artifact) {
      res.status(404).json({ message: 'Screenshot artifact not found' });
      return;
    }

    res.json(artifact);
  });

  app.post('/api/sessions/:sessionId/audio', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim() : '';
    const data = typeof req.body?.data === 'string' ? req.body.data.trim() : '';

    if (!mimeType || !data) {
      res.status(400).json({ message: 'mimeType and data are required' });
      return;
    }

    try {
      const session = getSession(req.params.sessionId);
      if (session?.provider === 'local') {
        res.status(202).json({ ok: true });
        return;
      }

      sendLiveAudioChunk(req.params.sessionId, { mimeType, data });
      res.status(202).json({ ok: true });
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
      const session = getSession(req.params.sessionId);
      if (session?.provider === 'local') {
        res.status(202).json({ ok: true });
        return;
      }

      endLiveAudioInput(req.params.sessionId);
      res.status(202).json({ ok: true });
    } catch (error) {
      res.status(500).json({
        message: error instanceof Error ? error.message : 'Unable to end live audio stream',
      });
    }
  });

  app.post('/api/sessions/:sessionId/tool-calls', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const ownerId = getSessionUserId(req.params.sessionId);
    if (!ownerId || ownerId !== user.id) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    const calls = Array.isArray(req.body?.calls) ? req.body.calls as Array<{ id?: string; name?: string; args?: Record<string, unknown> }> : [];
    res.json({
      functionResponses: await executeLiveFunctionCalls({
        sessionId: req.params.sessionId,
        userId: user.id,
        calls,
      }),
    });
  });

  app.post('/api/sessions/:sessionId/turns', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const ownerId = getSessionUserId(req.params.sessionId);
    if (!ownerId || ownerId !== user.id) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    const userText = typeof req.body?.userText === 'string' ? req.body.userText.trim() : '';
    const assistantText = typeof req.body?.assistantText === 'string' ? req.body.assistantText.trim() : '';

    if (!userText && !assistantText) {
      res.status(400).json({ message: 'userText or assistantText is required' });
      return;
    }

    if (userText) {
      insertTranscriptMessage({
        id: `USR-${randomUUID()}`,
        sessionId: req.params.sessionId,
        role: 'user',
        text: userText,
        status: 'complete',
      });
    }

    if (assistantText) {
      insertTranscriptMessage({
        id: `AST-${randomUUID()}`,
        sessionId: req.params.sessionId,
        role: 'agent',
        text: assistantText,
        status: 'complete',
      });
    }

    if (userText && assistantText) {
      const memberRow = db
        .prepare('SELECT workspace_id as workspaceId FROM workspace_members WHERE user_id = ? LIMIT 1')
        .get(user.id) as { workspaceId: string } | undefined;
      ingestLiveTurnMemory({
        userId: user.id,
        workspaceId: memberRow?.workspaceId,
        sessionId: req.params.sessionId,
        userText,
        assistantText,
      });
    }

    res.json(getLiveSessionState(req.params.sessionId));
  });

  app.post('/api/sessions/:sessionId/end', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const { sessionId } = req.params;
    const session = endGeminiLiveSession(sessionId) ?? endSession(sessionId);
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    void generateAndSaveSessionSummary(sessionId, user.id).catch(() => undefined);

    res.json(session);
  });
}
