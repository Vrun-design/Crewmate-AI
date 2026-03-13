import type { Express, Request, Response } from 'express';
import {
  deleteMemoryRecord,
  ingestArtifactMemory,
  ingestKnowledgeMemory,
  listMemoryOverview,
  setMemoryRecordActive,
} from '../services/memoryService';
import type { RequireAuth } from './types';

export function registerMemoryRoutes(app: Express, requireAuth: RequireAuth): void {
  app.get('/api/memory', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
    const source = typeof req.query.source === 'string' ? req.query.source : undefined;
    const limit = Number.parseInt(String(req.query.limit ?? '100'), 10);

    res.json(listMemoryOverview(user.id, {
      query: q,
      source: source as Parameters<typeof listMemoryOverview>[1]['source'],
      limitPerKind: Math.max(5, Math.min(limit, 50)),
    }));
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

    setMemoryRecordActive(user.id, id, active);
    res.json({ id, active });
  });

  app.delete('/api/memory/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const { id } = req.params;
    deleteMemoryRecord(user.id, id);
    res.status(204).end();
  });

  app.post('/api/memory/ingest', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const type = typeof req.body?.type === 'string' ? req.body.type : 'document';
    const kind = typeof req.body?.kind === 'string' ? req.body.kind : '';
    const searchText = typeof req.body?.searchText === 'string' ? req.body.searchText.trim() : '';
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';

    if (!title) {
      res.status(400).json({ message: 'title is required' });
      return;
    }

    const id = kind === 'artifact' || url || type === 'integration'
      ? ingestArtifactMemory({
        userId: user.id,
        workspaceId: user.workspaceId,
        title,
        url: url || undefined,
        summary: searchText || undefined,
      })
      : ingestKnowledgeMemory({
        userId: user.id,
        workspaceId: user.workspaceId,
        title,
        summary: searchText || title,
        contentText: searchText || undefined,
        sourceType: 'manual',
      });

    res.status(201).json({ id });
  });
}
