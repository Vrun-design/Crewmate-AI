import type { Express, Request, Response } from 'express';
import { db } from '../db';
import { getDashboardPayload } from '../repositories/dashboardRepository';
import { createWorkspaceTask, getTaskDetail, getTaskRuns, listActivities, listSessionHistory, listTasks } from '../repositories/workspaceRepository';
import { listCapabilities } from '../services/capabilityService';
import { addSseClient } from '../services/eventService';
import { getOnboardingProfile, saveOnboardingProfile } from '../services/onboardingProfileService';
import { getUserPreferences, saveUserPreferences } from '../services/preferencesService';
import { getFeatureFlags } from '../services/featureFlagService';
import { createClickUpTask, isClickUpConfigured } from '../services/clickupService';
import { createNotionPage, isNotionConfigured } from '../services/notionService';
import { createCalendarEvent } from '../services/calendarService';
import { createGoogleDocument } from '../services/docsService';
import { createDriveFolder } from '../services/driveService';
import { createGmailDraft } from '../services/gmailService';
import { createGoogleSpreadsheet } from '../services/sheetsService';
import { createGooglePresentation } from '../services/slidesService';
import { ingestArtifactLink } from '../services/memoryIngestor';
import { cancelTask } from '../services/orchestrator';
import { delegateSkillExecution, orchestrate } from '../services/orchestrator';
import { createErrorResponse, logServerError } from '../services/runtimeLogger';
import type { UserPreferencesRecord } from '../types';
import type { RequireAuth } from './types';

function buildGoogleRows(description: string): string[][] {
  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) =>
    line.includes(',')
      ? line.split(',').map((cell) => cell.trim())
      : [line],
  );
}

function buildGoogleSlides(description: string, title: string): Array<{ title: string; body?: string }> {
  const sections = description
    .split(/\n\s*\n/g)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length === 0) {
    return [{ title }];
  }

  return sections.map((section, index) => {
    const [firstLine, ...rest] = section.split('\n');
    const slideTitle = firstLine?.trim() || `${title} ${index + 1}`;
    const body = rest.join('\n').trim();
    return {
      title: slideTitle,
      ...(body ? { body } : {}),
    };
  });
}

function extractLabeledField(description: string, label: string): string {
  const pattern = new RegExp(`^${label}:\\s*(.+)$`, 'im');
  const match = description.match(pattern);
  return match?.[1]?.trim() ?? '';
}

function stripLabeledFields(description: string, labels: string[]): string {
  return description
    .split('\n')
    .filter((line) => !labels.some((label) => new RegExp(`^${label}:\\s*`, 'i').test(line.trim())))
    .join('\n')
    .trim();
}

function buildGmailDraftInput(title: string, description: string): { to: string; subject: string; bodyText: string } {
  const to = extractLabeledField(description, 'to');
  const bodyText = stripLabeledFields(description, ['to']);

  if (!to) {
    throw new Error('For Gmail Draft, add a line like "To: person@example.com" in the description.');
  }

  return {
    to,
    subject: title,
    bodyText: bodyText || title,
  };
}

function parseEventDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date/time: "${value}". Use a clear date like 2026-03-15 10:00.`);
  }

  return parsed.toISOString();
}

function buildCalendarEventInput(title: string, description: string): {
  summary: string;
  description?: string;
  start: string;
  end: string;
} {
  const startRaw = extractLabeledField(description, 'start');
  const endRaw = extractLabeledField(description, 'end');
  const details = stripLabeledFields(description, ['start', 'end']);

  if (!startRaw || !endRaw) {
    throw new Error('For Google Calendar, add "Start: ..." and "End: ..." lines in the description.');
  }

  return {
    summary: title,
    ...(details ? { description: details } : {}),
    start: parseEventDate(startRaw),
    end: parseEventDate(endRaw),
  };
}

async function executeIntegrationTask(tool: string, workspaceId: string, title: string, description: string): Promise<string | undefined> {
  switch (tool) {
    case 'Notion':
      if (!isNotionConfigured(workspaceId)) throw new Error('Notion integration is not configured.');
      const notionResult = await createNotionPage(workspaceId, { title, content: description });
      return notionResult.url;
    case 'ClickUp':
      if (!isClickUpConfigured(workspaceId)) throw new Error('ClickUp integration is not configured.');
      const clickupResult = await createClickUpTask(workspaceId, { name: title, description });
      return clickupResult.url;
    case 'Google Docs': {
      const result = await createGoogleDocument(workspaceId, { title, content: description });
      return result.url;
    }
    case 'Google Sheets': {
      const result = await createGoogleSpreadsheet(workspaceId, {
        title,
        rows: description.trim() ? buildGoogleRows(description) : undefined,
      });
      return result.url;
    }
    case 'Google Slides': {
      const result = await createGooglePresentation(workspaceId, {
        title,
        slides: buildGoogleSlides(description, title),
      });
      return result.url;
    }
    case 'Google Drive': {
      const result = await createDriveFolder(workspaceId, { name: title });
      return result.url;
    }
    case 'Google Calendar': {
      const result = await createCalendarEvent(workspaceId, buildCalendarEventInput(title, description));
      return result.htmlLink;
    }
    case 'Gmail Draft': {
      const result = await createGmailDraft(workspaceId, buildGmailDraftInput(title, description));
      return `https://mail.google.com/mail/u/0/#drafts?compose=${encodeURIComponent(result.id)}`;
    }
    case 'Crewmate':
      // Local workspace task only, no external sync needed
      return undefined;
  }
}

export function registerWorkspaceRoutes(app: Express, requireAuth: RequireAuth): void {
  app.get('/api/health', (_req: Request, res: Response) => {
    try {
      const dbOk = Boolean(db.prepare('SELECT 1').get());
      const { ALL_SKILLS } = require('../skills/index') as typeof import('../skills/index');
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
      logServerError('workspaceRoutes:health', err);
      const errorResponse = createErrorResponse('Health check failed.', {
        code: 'health_check_failed',
        retryable: true,
      });
      res.status(errorResponse.status).json({ ok: false, ...errorResponse.body });
    }
  });

  app.get('/api/audit', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
    try {
      const { listAuditLog } = require('../services/auditLogger') as typeof import('../services/auditLogger');
      res.json(listAuditLog(limit, user.id));
    } catch (error) {
      logServerError('workspaceRoutes:audit-log', error, { userId: user.id, limit });
      res.json([]);
    }
  });

  app.get('/api/events', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.write('event: ping\ndata: "connected"\n\n');
    addSseClient(req.socket.remoteAddress + '-' + Date.now(), user.id, req, res);
  });

  app.get('/api/dashboard', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getDashboardPayload(user.workspaceId, user.id));
  });

  app.get('/api/tasks', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listTasks(user.id));
  });

  app.get('/api/tasks/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const task = getTaskDetail(req.params.id, user.id);
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    res.json(task);
  });

  app.get('/api/tasks/:id/runs', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getTaskRuns(req.params.id, user.id));
  });

  app.post('/api/tasks/:id/cancel', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const task = getTaskDetail(req.params.id, user.id);
    if (!task) {
      res.status(404).json({ message: 'Task not found' });
      return;
    }

    const activeRunId = task.runs.find((run) => run.status === 'queued' || run.status === 'running')?.id
      ?? task.latestRun?.id
      ?? task.currentRunId
      ?? null;
    if (!activeRunId) {
      res.status(400).json({ message: 'This task cannot be cancelled from the current runtime path yet.' });
      return;
    }

    const cancelled = cancelTask(activeRunId, user.id);
    if (!cancelled) {
      res.status(404).json({ message: 'Task run not found' });
      return;
    }

    const nextTask = getTaskDetail(req.params.id, user.id);
    res.json(nextTask ?? task);
  });

  app.post('/api/tasks', async (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const mode = req.body?.mode === 'delegated' ? 'delegated' : 'manual';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const tool = typeof req.body?.tool === 'string' ? req.body.tool.trim() : '';
    const priority = typeof req.body?.priority === 'string' ? req.body.priority.trim() : '';

    if (!title) {
      res.status(400).json({ message: 'title is required' });
      return;
    }

    if (!tool) {
      res.status(400).json({ message: 'tool is required' });
      return;
    }

    if (!['Low', 'Medium', 'High'].includes(priority)) {
      res.status(400).json({ message: 'priority must be Low, Medium, or High' });
      return;
    }

    try {
      if (mode === 'delegated') {
        const intent = description ? `${title}\n\n${description}` : title;
        let taskId: string;

        if (tool === 'Notion') {
          const delegated = await delegateSkillExecution(
            'notion.create-page',
            { userId: user.id, workspaceId: user.workspaceId, originType: 'app' },
            { title, content: description || title },
            { intent: `Create Notion Page: ${title}`, originType: 'app' },
          );
          taskId = delegated.taskId;
        } else if (tool === 'ClickUp') {
          const delegated = await delegateSkillExecution(
            'clickup.create-task',
            { userId: user.id, workspaceId: user.workspaceId, originType: 'app' },
            { name: title, description },
            { intent: `Create ClickUp Task: ${title}`, originType: 'app' },
          );
          taskId = delegated.taskId;
        } else {
          const delegated = await orchestrate(intent, {
            userId: user.id,
            workspaceId: user.workspaceId,
            originType: 'app',
          });
          taskId = delegated.taskId;
        }

        const task = getTaskDetail(taskId, user.id);
        if (!task) {
          res.status(500).json({ message: 'Delegated task was created but could not be loaded.' });
          return;
        }

        res.status(201).json(task);
        return;
      }

      const url = await executeIntegrationTask(tool, user.workspaceId, title, description);

      if (url) {
        ingestArtifactLink({
          userId: user.id,
          workspaceId: user.workspaceId,
          title,
          url,
          provider: tool,
          summary: description || `${tool} artifact created from Crewmate`,
        });
      }

      const task = createWorkspaceTask(user.id, {
        title,
        description,
        tool,
        priority: priority as 'Low' | 'Medium' | 'High',
        url,
      });

      res.status(201).json(task);
    } catch (error) {
      logServerError('workspaceRoutes:create-task', error, { userId: user.id, mode, tool });
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : `Failed to create task in ${tool}`,
        {
          code: 'task_create_failed',
          retryable: true,
        },
      );
      res.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.get('/api/activities', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listActivities(user.id));
  });

  app.get('/api/sessions/history', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listSessionHistory(user.id));
  });

  app.delete('/api/sessions/:id', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    const { id } = req.params;
    db.prepare('DELETE FROM session_messages WHERE session_id = ?').run(id);
    const result = db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, user.id);
    if (result.changes === 0) {
      res.status(404).json(createErrorResponse('Session not found', {
        status: 404,
        code: 'session_not_found',
        retryable: false,
      }).body);
      return;
    }
    res.status(204).send();
  });

  app.get('/api/capabilities', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(listCapabilities(user.workspaceId, user.id));
  });

  app.get('/api/feature-flags', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getFeatureFlags());
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

  app.get('/api/onboarding/profile', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;
    res.json(getOnboardingProfile(user.id));
  });

  app.put('/api/onboarding/profile', (req: Request, res: Response) => {
    const user = requireAuth(req, res);
    if (!user) return;

    const agentName = typeof req.body?.agentName === 'string' ? req.body.agentName.trim() : '';
    const voiceModel = typeof req.body?.voiceModel === 'string' ? req.body.voiceModel.trim() : '';

    if (!voiceModel) {
      res.status(400).json({ message: 'voiceModel is required' });
      return;
    }

    res.json(saveOnboardingProfile(user.id, { agentName, voiceModel }));
  });
}
