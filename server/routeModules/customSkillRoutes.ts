import type { Express, Request, Response } from 'express';
import { validateWebhookUrl } from '../services/customSkillRunner';
import { createCustomSkill, deleteCustomSkill, listCustomSkills } from '../skills/registry';
import type { RequireAuth } from './types';

type CustomSkillCreateBody = {
  name: string;
  description: string;
  triggerPhrases?: string[];
  mode: 'webhook' | 'recipe';
  webhookUrl?: string;
  authHeader?: string;
  recipe?: string;
};

export function registerCustomSkillRoutes(app: Express, requireAuth: RequireAuth): void {
  app.get('/api/custom-skills', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    res.json(listCustomSkills(user.id));
  });

  app.post('/api/custom-skills', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const { name, description, triggerPhrases = [], mode, webhookUrl, authHeader, recipe } =
      req.body as CustomSkillCreateBody;

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
      if (mode === 'webhook' && webhookUrl) {
        validateWebhookUrl(webhookUrl.trim());
      }

      const id = `csk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const record = createCustomSkill({
        id,
        userId: user.id,
        name,
        description,
        triggerPhrases: Array.isArray(triggerPhrases) ? triggerPhrases : [],
        mode,
        webhookUrl,
        authHeader,
        recipe,
        inputSchema: '{"input":{"type":"string","description":"Input text"}}',
      });

      res.json({ success: true, skill: record });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.delete('/api/custom-skills/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const deleted = deleteCustomSkill(req.params.id, user.id);
    res.json({ success: deleted });
  });

  app.post('/api/custom-skills/:id/test', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const userSkills = listCustomSkills(user.id);
    const skill = userSkills.find((item) => item.id === req.params.id);
    if (!skill) {
      res.status(404).json({ error: 'Custom skill not found' });
      return;
    }

    const args = (req.body as { args?: Record<string, unknown> }).args ?? {};

    try {
      if (skill.mode === 'webhook' && skill.webhookUrl) {
        const { executeWebhookSkill } = await import('../services/customSkillRunner');
        const result = await executeWebhookSkill(skill.webhookUrl, args, skill.authHeader);
        res.json(result);
        return;
      }

      if (skill.mode === 'recipe' && skill.recipe) {
        const { executeLLMRecipeSkill } = await import('../services/customSkillRunner');
        const result = await executeLLMRecipeSkill(skill.recipe, args, {
          userId: user.id,
          workspaceId: user.workspaceId,
        });
        res.json(result);
        return;
      }

      res.json({ success: false, message: 'Skill misconfigured' });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
