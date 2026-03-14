import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { AGENT_MANIFESTS, cancelTask, getTask, listTasks as listAgentTasks, orchestrate, subscribeToTask } from '../services/orchestrator';
import { createErrorResponse, logServerError } from '../services/runtimeLogger';
import { serializeSkillSummary } from '../skills/framework';
import { getSkillRunHistory, listSkillsForUser, runSkill } from '../skills/registry';
import { serverConfig } from '../config';
import type { RequireAuth } from './types';

/**
 * Registers the public A2A agent discovery endpoint.
 * GET /.well-known/agent.json — no auth required (public discovery, like robots.txt)
 * Follows Google's Agent-to-Agent (A2A) protocol spec so external agents
 * can discover Crewmate's capabilities and endpoint addresses.
 */
export function registerA2ADiscovery(app: Express): void {
  app.get('/.well-known/agent.json', (_req: Request, res: Response) => {
    const baseUrl = serverConfig.publicWebAppUrl?.replace(/\/$/, '') ?? '';

    res.json({
      id: 'crewmate-ai',
      name: 'Crewmate AI',
      description:
        'Always-on AI workforce: real-time Gemini Live sessions with audio/vision, ' +
        '14 specialist agents (research, content, product, HR, legal, data, UI navigator, and more), ' +
        'durable memory, Google Workspace integration, and cross-app automation.',
      version: '1.0.0',
      protocol: 'a2a/1.0',
      url: baseUrl,
      capabilities: [
        'gemini-live-audio',
        'gemini-live-vision',
        'screen-perception',
        'ui-navigation',
        'research',
        'content-generation',
        'google-workspace',
        'memory',
        'task-orchestration',
        'slack',
        'notion',
        'clickup',
      ],
      endpoints: {
        orchestrate: `${baseUrl}/api/orchestrate`,
        tasks: `${baseUrl}/api/agents/tasks`,
        agents: `${baseUrl}/api/agents`,
        skills: `${baseUrl}/api/skills`,
        liveSession: `${baseUrl}/api/live-session`,
      },
      agents: AGENT_MANIFESTS.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
      })),
      hostedOn: 'Google Cloud Run',
      contact: 'https://github.com/Vrun-design/Crewmate-AI',
    });
  });
}

export function registerAgentRoutes(app: Express, requireAuth: RequireAuth): void {
  app.get('/api/skills', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const skillList = listSkillsForUser(user.id);
    res.json(skillList.map((skill) => serializeSkillSummary(skill)));
  });

  app.post('/api/skills/:id/run', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const skillId = req.params.id;
    const args = (req.body?.args ?? {}) as Record<string, unknown>;
    const memberRow = db
      .prepare('SELECT workspace_id FROM workspace_members WHERE user_id = ? LIMIT 1')
      .get(user.id) as { workspace_id: string } | undefined;

    try {
      const result = await runSkill(skillId, {
        userId: user.id,
        workspaceId: memberRow?.workspace_id ?? '',
      }, args);
      res.json(result);
    } catch (err) {
      logServerError('agentRoutes:run-skill', err, { userId: user.id, skillId });
      const errorResponse = createErrorResponse(
        err instanceof Error ? err.message : 'Skill run failed',
        { status: 400, code: 'skill_run_failed', retryable: false },
      );
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });


  app.get('/api/skills/:id/runs', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getSkillRunHistory(req.params.id, user.id));
  });


  app.post('/api/orchestrate', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const { intent } = req.body as { intent?: string };
    if (!intent) {
      res.status(400).json({ error: 'Missing required field: intent' });
      return;
    }

    try {
      const { taskId, routeType } = await orchestrate(intent, { userId: user.id, workspaceId: user.workspaceId });
      res.json({ taskId, routeType, status: 'queued', message: 'Intent dispatched to orchestrator' });
    } catch (err) {
      logServerError('agentRoutes:orchestrate', err, { userId: user.id });
      const errorResponse = createErrorResponse('Unable to dispatch intent to the orchestrator right now.', {
        code: 'orchestrate_failed',
        retryable: true,
      });
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.get('/api/agents/tasks', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const limit = Number.parseInt(String(req.query.limit ?? '20'), 10);
    res.json(listAgentTasks(user.id, limit));
  });

  app.get('/api/agents/tasks/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const task = getTask(req.params.id, user.id);
    if (!task) {
      res.status(404).json(createErrorResponse('Task not found', {
        status: 404,
        code: 'task_not_found',
        retryable: false,
      }).body);
      return;
    }

    res.json(task);
  });

  app.post('/api/agents/tasks/:id/cancel', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const task = cancelTask(req.params.id, user.id);
    if (!task) {
      res.status(404).json(createErrorResponse('Task not found', {
        status: 404,
        code: 'task_not_found',
        retryable: false,
      }).body);
      return;
    }

    res.json(task);
  });

  app.get('/api/agents/tasks/:id/events', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const task = getTask(req.params.id, user.id);
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

  app.get('/api/agents', (_req: Request, res: Response) => {
    res.json(AGENT_MANIFESTS);
  });

  /**
   * GET /api/agents/tasks/:id/screenshot
   * Returns the most recent screenshot artifact captured during a UI Navigator task run.
   * Frontend polls this every 2s to drive the BrowserSessionPiP live view.
   */
  app.get('/api/agents/tasks/:id/screenshot', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const taskRunId = req.params.id;
    const task = getTask(taskRunId, user.id);

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Lazy-import to avoid circular dep
    const {
      countScreenshotArtifacts,
      listRecentScreenshotArtifacts,
    } = await import('../services/screenshotArtifactService');
    const { getUiNavigatorArtifactUrl } = await import('../services/uiNavigator/uiNavigatorArtifactBridge');

    const runScopedArtifacts = listRecentScreenshotArtifacts(user.id, { taskRunId, limit: 1 });
    const taskScopedArtifacts = runScopedArtifacts.length === 0
      ? listRecentScreenshotArtifacts(user.id, { taskId: task.workspaceTaskId ?? taskRunId, limit: 1 })
      : [];
    const artifact = runScopedArtifacts[0] ?? taskScopedArtifacts[0] ?? null;
    const artifactStepCount = countScreenshotArtifacts(user.id, { taskRunId })
      || countScreenshotArtifacts(user.id, { taskId: task.workspaceTaskId ?? taskRunId });

    if (!artifact) {
      // No screenshot yet — return status so PiP can show a loading skeleton
      res.json({
        screenshotUrl: null,
        currentUrl: null,
        stepCount: task.steps?.length ?? 0,
        status: task.status,
        intent: task.intent,
        capturedAt: null,
      });
      return;
    }

    // Find the most recent step that has a currentUrl
    const latestUrlStep = [...(task.steps ?? [])].reverse().find((s) => s.currentUrl);
    const taskResult = task.result && typeof task.result === 'object'
      ? task.result as { output?: { finalUrl?: string } | null; finalUrl?: string | null }
      : null;

    res.json({
      screenshotUrl: artifact.publicUrl,
      currentUrl: getUiNavigatorArtifactUrl(artifact.caption) ?? latestUrlStep?.currentUrl ?? taskResult?.output?.finalUrl ?? taskResult?.finalUrl ?? null,
      stepCount: artifactStepCount || task.steps?.length || 0,
      status: task.status,
      intent: task.intent,
      capturedAt: artifact.createdAt,
    });
  });
}
