import type { Express, Request, Response } from 'express';
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
import { getSession } from '../repositories/sessionRepository';
import { endSession, sendLocalSessionMessage, startSession } from '../services/sessionService';
import type { RequireAuth } from './types';

export function registerLiveSessionRoutes(app: Express, requireAuth: RequireAuth): void {
  app.post('/api/sessions/onboarding', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const { agentName = 'Crewmate', voice = 'alex' } = req.body as { agentName?: string; voice?: string };

    try {
      const session = startSession(user.id);
      await startGeminiLiveSession(session.id);
      res.json({ sessionId: session.id, agentName, voice, message: 'Onboarding live session started' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/sessions', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.status(201).json(startSession(user.id));
  });

  app.post('/api/sessions/live', async (req: Request, res: Response) => {
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

  app.post('/api/sessions/:sessionId/end', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const session = endGeminiLiveSession(req.params.sessionId) ?? endSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ message: 'Session not found' });
      return;
    }

    res.json(session);
  });
}
