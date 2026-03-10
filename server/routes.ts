import type { Express, Request, Response } from 'express';
import { db } from './db';
import { getDashboardPayload } from './repositories/dashboardRepository';
import { listActivities, listSessionHistory, listTasks } from './repositories/workspaceRepository';
import { clearAuthSession, getAuthUser, requestLoginCode, verifyLoginCode } from './services/authService';
import { listCapabilities } from './services/capabilityService';
import { generateCreativeArtifact } from './services/creativeStudioService';
import { enqueueResearchBriefJob, listJobs } from './services/delegationService';
import {
  deleteIntegrationConfig,
  getIntegrationConfigState,
  saveIntegrationConfig,
} from './services/integrationConfigService';
import { listIntegrationCatalog } from './services/integrationCatalog';
import { ingestMemoryNode, listMemoryNodes, retrieveRelevantMemories } from './services/memoryService';
import { listNotifications, markAllNotificationsRead } from './services/notificationService';
import { getUserPreferences, saveUserPreferences } from './services/preferencesService';
import { endSession, startSession } from './services/sessionService';
import { buildGmailAuthUrl, exchangeGmailCode, readGmailInbox, isGmailConfigured } from './services/gmailService';
import { buildCalendarAuthUrl, exchangeCalendarCode } from './services/calendarService';
import { orchestrate, getTask, listTasks as listAgentTasks, subscribeToTask, AGENT_MANIFESTS } from './services/orchestrator';
import { listCustomSkills, createCustomSkill, deleteCustomSkill, loadCustomSkills } from './skills/registry';
import { getNotificationPrefs, saveNotificationPrefs } from './services/notificationPrefsService';
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
import { addSseClient } from './services/eventService';
import { listPersonas, getActivePersona, setActivePersona } from './services/personaService';
import type { AuthUserRecord, UserPreferencesRecord } from './types';

function requireAuth(req: Request, res: Response): AuthUserRecord | null {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const user = token ? getAuthUser(token) : null;

  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }

  return user;
}

export function registerRoutes(app: Express) {
  app.post('/api/auth/request-code', (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email) {
      res.status(400).json({ message: 'email is required' });
      return;
    }

    res.status(201).json(requestLoginCode(email));
  });

  app.post('/api/auth/verify', (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';

    if (!email || !code) {
      res.status(400).json({ message: 'email and code are required' });
      return;
    }

    try {
      res.json(verifyLoginCode(email, code));
    } catch (error) {
      res.status(401).json({ message: error instanceof Error ? error.message : 'Verification failed' });
    }
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const user = token ? getAuthUser(token) : null;

    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
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

  // ── Health endpoint (Phase 10 — enriched for GCP Cloud Run) ───────────────
  app.get('/api/health', (_req: Request, res: Response) => {
    try {
      // Quick DB liveness check
      const dbOk = Boolean(db.prepare('SELECT 1').get());
      const { ALL_SKILLS } = require('./skills/index');
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

  // ── Onboarding session route (Phase 9) ────────────────────────────────────
  // POST /api/sessions/onboarding — starts a Gemini Live session with onboarding system prompt
  app.post('/api/sessions/onboarding', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const { agentName = 'Crewmate', voice = 'alex' } = req.body as { agentName?: string; voice?: string };

    const onboardingSystemPrompt = `You are ${agentName}, an AI agent helping a new user set up their Crewmate workspace.
Your goal is to understand what the user is working on, what tools they use (GitHub, Slack, Notion, ClickUp, Gmail), and what kind of tasks they want help with.

Ask these questions conversationally, one at a time:
1. "Hi! I'm ${agentName}. What should I call you?"
2. "What are you currently building or working on?"
3. "Which tools do you use most? GitHub, Slack, Notion, ClickUp, or others?"
4. "What kind of tasks would you like me to help automate?"
5. "Is there anything I should never do without asking you first?"

After gathering answers, summarize what you've learned and tell the user what integrations to connect in the Integrations page.
Keep responses warm, concise, and voice-friendly. Avoid long lists — speak naturally.`;

    try {
      const { startSession } = await import('./services/sessionService');
      const session = startSession(user.id);
      const { startGeminiLiveSession } = await import('./services/liveGateway');
      await startGeminiLiveSession(session.id);
      res.json({ sessionId: session.id, agentName, voice, message: 'Onboarding live session started' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Audit log route (Phase 10) ────────────────────────────────────────────
  app.get('/api/audit', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const limit = parseInt(String(req.query.limit ?? '50'), 10);
    try {
      const { listAuditLog } = require('./services/auditLogger');
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

    // Send an initial ping so the client knows it's connected
    res.write('event: ping\ndata: "connected"\n\n');

    addSseClient(req.socket.remoteAddress + '-' + Date.now(), user.id, req, res);
  });

  app.get('/api/dashboard', (_req: Request, res: Response) => {
    const user = requireAuth(_req, res);
    if (!user) return;
    res.json(getDashboardPayload(user.workspaceId, user.id));
  });

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

  app.get('/api/memory/nodes', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const personaId = typeof req.query.personaId === 'string' ? req.query.personaId : undefined;
    if (query) {
      // For search, leverage semantic retrieval but return full nodes
      const allNodes = listMemoryNodes();
      const relevantTitles = await retrieveRelevantMemories(query, 50, personaId);
      const titleSet = new Set(relevantTitles);
      res.json(allNodes.filter(n => titleSet.has(n.title)));
    } else {
      res.json(listMemoryNodes());
    }
  });

  // ── Unified memory API (Phase 8) — supports persona, source, search filters ─
  app.get('/api/memory', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const personaId = typeof req.query.personaId === 'string' ? req.query.personaId : undefined;
    const source = typeof req.query.source === 'string' ? req.query.source : undefined;
    const limit = parseInt(String(req.query.limit ?? '100'), 10);

    try {
      const { listMemoryTimeline } = await import('./services/memoryIngestor');
      const nodes = listMemoryTimeline({ searchQuery: q, personaId, source: source as Parameters<typeof listMemoryTimeline>[0]['source'], limit });
      res.json(nodes);
    } catch {
      // Fallback to basic list if ingestor not available
      res.json(listMemoryNodes());
    }
  });

  // PATCH /api/memory/:id — toggle active state (used by new MemoryBase UI)
  app.patch('/api/memory/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { id } = req.params;
    const { active } = req.body as { active?: boolean };
    if (typeof active !== 'boolean') {
      res.status(400).json({ error: 'active boolean required' });
      return;
    }
    db.prepare('UPDATE memory_nodes SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
    res.json({ id, active });
  });

  app.post('/api/memory/nodes/:id/toggle', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const { id } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
      res.status(400).json({ message: 'active boolean is required' });
      return;
    }

    const { db } = require('./db');
    db.prepare(`UPDATE memory_nodes SET active = ? WHERE id = ?`).run(active ? 1 : 0, id);
    res.json({ id, active });
  });

  app.get('/api/sessions/history', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listSessionHistory());
  });

  app.get('/api/notifications', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listNotifications(user.id));
  });

  app.post('/api/notifications/read-all', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    markAllNotificationsRead(user.id);
    res.status(204).send();
  });

  app.get('/api/capabilities', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listCapabilities(user.workspaceId, user.id));
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
      res.status(400).json({ message: 'topic and goal are required' });
      return;
    }

    const job = enqueueResearchBriefJob(user.workspaceId, user.id, {
      topic,
      goal,
      audience,
      deliverToNotion: Boolean(req.body?.deliverToNotion),
      notifyInSlack: Boolean(req.body?.notifyInSlack),
    });
    res.status(201).json(job);
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

  app.post('/api/sessions', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.status(201).json(startSession(user.id));
  });

  app.post('/api/sessions/live', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

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
      res.status(400).json({ message: 'mimeType and data are required' });
      return;
    }

    try {
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
      res.status(400).json({ message: 'title is required' });
      return;
    }

    const id = ingestMemoryNode({
      title,
      type: ['document', 'preference', 'integration', 'core'].includes(type) ? type : 'document',
    });

    res.status(201).json({ id });
  });

  // ── Persona routes ──────────────────────────────────────────────────

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
      const persona = setActivePersona(user.id, personaId);
      res.json(persona);
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : 'Invalid personaId' });
    }
  });

  // ── Skills routes ────────────────────────────────────────────────────

  app.get('/api/skills', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { listSkills, listSkillsForPersona } = require('./skills/registry') as typeof import('./skills/registry');
    const personaId = typeof req.query.persona === 'string' ? req.query.persona : undefined;
    const skillList = personaId ? listSkillsForPersona(personaId) : listSkills();
    res.json(skillList.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      version: s.version,
      category: s.category,
      personas: s.personas,
      requiresIntegration: s.requiresIntegration,
      triggerPhrases: s.triggerPhrases,
      preferredModel: s.preferredModel,
    })));
  });

  app.post('/api/skills/:id/run', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const skillId = req.params.id;
    const args = (req.body?.args ?? {}) as Record<string, unknown>;
    const memberRow = db.prepare(`SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1`).get(user.id) as { workspace_id: string } | undefined;
    const { runSkill } = require('./skills/registry') as typeof import('./skills/registry');
    try {
      const result = await runSkill(skillId, {
        userId: user.id,
        workspaceId: memberRow?.workspace_id ?? '',
        personaId: undefined,
      }, args);
      res.json(result);
    } catch (err) {
      res.status(400).json({ message: err instanceof Error ? err.message : 'Skill run failed' });
    }
  });

  app.get('/api/skills/:id/runs', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { getSkillRunHistory } = require('./skills/registry') as typeof import('./skills/registry');
    const runs = getSkillRunHistory(req.params.id, user.id);
    res.json(runs);
  });

  // ── Gmail Inbox Preview ───────────────────────────────────────────────
  app.get('/api/gmail/inbox', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const maxResults = parseInt(String(req.query.maxResults ?? '5'), 10);

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

  // ── A2A Orchestrator routes ───────────────────────────────────────────────
  // POST /api/orchestrate — dispatch a user intent to the best agent/skill
  app.post('/api/orchestrate', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const { intent } = req.body as { intent?: string };
    if (!intent) {
      res.status(400).json({ error: 'Missing required field: intent' });
      return;
    }

    try {
      const { taskId } = await orchestrate(intent, { userId: user.id, workspaceId: user.workspaceId });
      res.json({ taskId, status: 'queued', message: 'Intent dispatched to orchestrator' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/agents/tasks — list recent agent tasks
  app.get('/api/agents/tasks', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const limit = parseInt(String(req.query.limit ?? '20'), 10);
    res.json(listAgentTasks(limit));
  });

  // GET /api/agents/tasks/:id — get a specific task
  app.get('/api/agents/tasks/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const task = getTask(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  });

  // GET /api/agents/tasks/:id/events — SSE stream for a specific task
  app.get('/api/agents/tasks/:id/events', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send current state immediately
    const task = getTask(req.params.id);
    if (task) {
      res.write(`data: ${JSON.stringify({ type: 'snapshot', task })}\n\n`);
    }

    const unsubscribe = subscribeToTask(req.params.id, (event) => {
      res.write(event);
    });

    req.on('close', () => {
      unsubscribe();
      res.end();
    });
  });

  // GET /api/agents — list available agents with their capabilities (uses live manifests)
  app.get('/api/agents', (_req: Request, res: Response) => {
    res.json(AGENT_MANIFESTS);
  });

  // ── Custom Skill CRUD routes (Phase 13) ─────────────────────────────────

  // GET /api/custom-skills — list user's custom skills
  app.get('/api/custom-skills', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listCustomSkills(user.id));
  });

  // POST /api/custom-skills — create a new custom skill
  app.post('/api/custom-skills', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { name, description, triggerPhrases = [], mode, webhookUrl, authHeader, recipe } = req.body as {
      name: string; description: string; triggerPhrases?: string[];
      mode: 'webhook' | 'recipe'; webhookUrl?: string; authHeader?: string; recipe?: string;
    };
    if (!name || !description || !mode) {
      res.status(400).json({ error: 'name, description, and mode are required' });
      return;
    }
    if (mode === 'webhook' && !webhookUrl) {
      res.status(400).json({ error: 'webhookUrl required for webhook mode' });
      return;
    }
    if (mode === 'recipe' && !recipe) {
      res.status(400).json({ error: 'recipe required for recipe mode' });
      return;
    }
    try {
      const id = `csk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const rec = createCustomSkill({
        id, userId: user.id, name, description,
        triggerPhrases: Array.isArray(triggerPhrases) ? triggerPhrases : [],
        mode, webhookUrl, authHeader, recipe,
        inputSchema: '{"input":{"type":"string","description":"Input text"}}',
      });
      res.json({ success: true, skill: rec });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // DELETE /api/custom-skills/:id — delete a custom skill
  app.delete('/api/custom-skills/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const deleted = deleteCustomSkill(req.params.id, user.id);
    res.json({ success: deleted });
  });

  // POST /api/custom-skills/:id/test — dry run a custom skill
  app.post('/api/custom-skills/:id/test', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const userSkills = listCustomSkills(user.id);
    const skill = userSkills.find((s) => s.id === req.params.id);
    if (!skill) { res.status(404).json({ error: 'Custom skill not found' }); return; }
    const args = (req.body as { args?: Record<string, unknown> }).args ?? {};
    try {
      let result;
      if (skill.mode === 'webhook' && skill.webhookUrl) {
        const { executeWebhookSkill: runWebhook } = await import('./services/customSkillRunner');
        result = await runWebhook(skill.webhookUrl, args, skill.authHeader);
      } else if (skill.mode === 'recipe' && skill.recipe) {
        const { executeLLMRecipeSkill: runRecipe } = await import('./services/customSkillRunner');
        result = await runRecipe(skill.recipe, args, { userId: user.id, workspaceId: user.workspaceId });
      } else {
        result = { success: false, message: 'Skill misconfigured' };
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });



  // ── Notification Preferences routes (Phase 15) ────────────────────────────

  // GET /api/notification-prefs
  app.get('/api/notification-prefs', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getNotificationPrefs(user.id));
  });

  // PATCH /api/notification-prefs
  app.patch('/api/notification-prefs', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { slackWebhookUrl, slackChannelName, notifyOnSuccess, notifyOnError, inAppEnabled } = req.body as {
      slackWebhookUrl?: string; slackChannelName?: string;
      notifyOnSuccess?: boolean; notifyOnError?: boolean; inAppEnabled?: boolean;
    };
    const updated = saveNotificationPrefs(user.id, {
      slackWebhookUrl: slackWebhookUrl !== undefined ? (slackWebhookUrl.trim() || undefined) : undefined,
      slackChannelName: slackChannelName !== undefined ? (slackChannelName.trim() || undefined) : undefined,
      ...(notifyOnSuccess !== undefined ? { notifyOnSuccess } : {}),
      ...(notifyOnError !== undefined ? { notifyOnError } : {}),
      ...(inAppEnabled !== undefined ? { inAppEnabled } : {}),
    });
    res.json(updated);
  });

  // POST /api/notification-prefs/test — fire a test Slack webhook
  app.post('/api/notification-prefs/test', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const prefs = getNotificationPrefs(user.id);
    if (!prefs.slackWebhookUrl) {
      res.status(400).json({ error: 'No Slack webhook URL configured' });
      return;
    }
    try {
      const resp = await fetch(prefs.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '🎉 Crewmate is connected! You\'ll receive agent task notifications here.',
        }),
        signal: AbortSignal.timeout(8000),
      });
      res.json({ success: resp.ok, status: resp.status });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Gmail OAuth routes ────────────────────────────────────────────────
  // Step 1: Redirect to Google consent screen
  app.get('/api/auth/gmail', (req: Request, res: Response) => {
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    const user = token ? getAuthUser(token) : null;
    const workspaceId = user?.workspaceId ?? (req.query.workspaceId as string) ?? 'default';
    res.redirect(buildGmailAuthUrl(workspaceId));
  });

  // Step 2: Handle Google redirect back with auth code
  app.get('/api/auth/gmail/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const workspaceId = (req.query.state as string) ?? 'default';

    if (!code) {
      res.status(400).send('Missing authorization code from Google');
      return;
    }

    try {
      await exchangeGmailCode(workspaceId, code);
      // Redirect back to integrations page with success indicator
      res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/integrations?connected=gmail`);
    } catch (err) {
      console.error('[Gmail OAuth] callback error:', err);
      res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/integrations?error=gmail_auth_failed`);
    }
  });

  // ── Google Calendar OAuth routes ──────────────────────────────────────
  app.get('/api/auth/calendar', (req: Request, res: Response) => {
    const token = (req.headers.authorization ?? '').replace('Bearer ', '');
    const user = token ? getAuthUser(token) : null;
    const workspaceId = user?.workspaceId ?? (req.query.workspaceId as string) ?? 'default';
    res.redirect(buildCalendarAuthUrl(workspaceId));
  });

  app.get('/api/auth/calendar/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const workspaceId = (req.query.state as string) ?? 'default';

    if (!code) {
      res.status(400).send('Missing authorization code from Google');
      return;
    }

    try {
      await exchangeCalendarCode(workspaceId, code);
      res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/integrations?connected=calendar`);
    } catch (err) {
      console.error('[Calendar OAuth] callback error:', err);
      res.redirect(`${process.env.CORS_ORIGIN ?? 'http://localhost:3000'}/integrations?error=calendar_auth_failed`);
    }
  });
}
