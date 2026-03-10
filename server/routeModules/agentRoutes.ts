import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { AGENT_MANIFESTS, getTask, listTasks as listAgentTasks, orchestrate, subscribeToTask } from '../services/orchestrator';
import { getSkillRunHistory, listSkillsForUserPersona, runSkill } from '../skills/registry';
import type { RequireAuth } from './types';


export function registerAgentRoutes(app: Express, requireAuth: RequireAuth): void {
  app.get('/api/skills', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const personaId = typeof req.query.persona === 'string' ? req.query.persona : undefined;
    const skillList = listSkillsForUserPersona(user.id, personaId);
    res.json(skillList.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      version: skill.version,
      category: skill.category,
      personas: skill.personas,
      requiresIntegration: skill.requiresIntegration,
      triggerPhrases: skill.triggerPhrases,
      preferredModel: skill.preferredModel,
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
      const { taskId } = await orchestrate(intent, { userId: user.id, workspaceId: user.workspaceId });
      res.json({ taskId, status: 'queued', message: 'Intent dispatched to orchestrator' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
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
      res.status(404).json({ error: 'Task not found' });
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
