import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { AGENT_MANIFESTS, cancelTask, getTask, listTasks as listAgentTasks, orchestrate, subscribeToTask } from '../services/orchestrator';
import { createErrorResponse, logServerError } from '../services/runtimeLogger';
import { getSkillRunHistory, listSkillsForUser, runSkill } from '../skills/registry';
import type { RequireAuth } from './types';


export function registerAgentRoutes(app: Express, requireAuth: RequireAuth): void {
  app.get('/api/skills', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const skillList = listSkillsForUser(user.id);
    res.json(skillList.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      version: skill.version,
      category: skill.category,
      requiresIntegration: skill.requiresIntegration,
      triggerPhrases: skill.triggerPhrases,
      preferredModel: skill.preferredModel,
      executionMode: skill.executionMode,
      latencyClass: skill.latencyClass,
      sideEffectLevel: skill.sideEffectLevel,
    })));
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
}
