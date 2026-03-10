import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { ingestMemoryNode, listMemoryNodesForUser, retrieveRelevantMemories } from '../services/memoryService';
import type { RequireAuth } from './types';

export function registerMemoryRoutes(app: Express, requireAuth: RequireAuth): void {
  app.get('/api/memory/nodes', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const personaId = typeof req.query.personaId === 'string' ? req.query.personaId : undefined;

    if (query) {
      const allNodes = listMemoryNodesForUser(user.id);
      const relevantTitles = await retrieveRelevantMemories(user.id, query, 50, personaId);
      const titleSet = new Set(relevantTitles);
      res.json(allNodes.filter((node) => titleSet.has(node.title)));
      return;
    }

    res.json(listMemoryNodesForUser(user.id));
  });

  app.get('/api/memory', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const personaId = typeof req.query.personaId === 'string' ? req.query.personaId : undefined;
    const source = typeof req.query.source === 'string' ? req.query.source : undefined;
    const limit = Number.parseInt(String(req.query.limit ?? '100'), 10);

    try {
      const { listMemoryTimeline } = await import('../services/memoryIngestor');
      const nodes = listMemoryTimeline({
        userId: user.id,
        searchQuery: q,
        personaId,
        source: source as Parameters<typeof listMemoryTimeline>[0]['source'],
        limit,
      });
      res.json(nodes);
    } catch {
      res.json(listMemoryNodesForUser(user.id));
    }
  });

  app.patch('/api/memory/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const { id } = req.params;
    const { active } = req.body as { active?: boolean };

    if (typeof active !== 'boolean') {
      res.status(400).json({ error: 'active boolean required' });
      return;
    }

    db.prepare('UPDATE memory_nodes SET active = ? WHERE id = ? AND user_id = ?').run(active ? 1 : 0, id, user.id);
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

    db.prepare('UPDATE memory_nodes SET active = ? WHERE id = ? AND user_id = ?').run(active ? 1 : 0, id, user.id);
    res.json({ id, active });
  });

  app.post('/api/memory/ingest', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const type = typeof req.body?.type === 'string' ? req.body.type : 'document';
    const allowedTypes = new Set(['document', 'preference', 'integration', 'core']);

    if (!title) {
      res.status(400).json({ message: 'title is required' });
      return;
    }

    const id = ingestMemoryNode({
      userId: user.id,
      workspaceId: user.workspaceId,
      title,
      type: allowedTypes.has(type) ? type : 'document',
    });

    res.status(201).json({ id });
  });
}
