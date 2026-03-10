import type { Express, Request, Response } from 'express';
import { enqueueResearchBriefJob, enqueueWorkflowRunJob, listJobs } from '../services/delegationService';
import { isFeatureEnabled } from '../services/featureFlagService';
import { listOffshiftWorkItems } from '../services/offshiftInboxService';
import { createWorkflowTemplate, deleteWorkflowTemplate, listWorkflowTemplates } from '../services/workflowTemplateService';
import type { RequireAuth } from './types';

export function registerJobRoutes(app: Express, requireAuth: RequireAuth): void {
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

        res.status(201).json(enqueueResearchBriefJob(user.workspaceId, user.id, {
            topic,
            goal,
            audience,
            deliverToNotion: Boolean(req.body?.deliverToNotion),
            notifyInSlack: Boolean(req.body?.notifyInSlack),
        }));
    });

    app.post('/api/jobs/workflow-run', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        if (!isFeatureEnabled('jobTypesV2')) {
            res.status(404).json({ message: 'Generic workflow runs are not enabled' });
            return;
        }

        const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
        const intent = typeof req.body?.intent === 'string' ? req.body.intent.trim() : '';

        if (!title || !intent) {
            res.status(400).json({ message: 'title and intent are required' });
            return;
        }

        res.status(201).json(enqueueWorkflowRunJob(user.workspaceId, user.id, {
            title,
            intent,
            deliverToNotion: Boolean(req.body?.deliverToNotion),
            notifyInSlack: Boolean(req.body?.notifyInSlack),
        }));
    });

    app.get('/api/offshift/inbox', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        if (!isFeatureEnabled('offshiftInbox')) {
            res.status(404).json({ message: 'Off-shift inbox is not enabled' });
            return;
        }
        res.json(listOffshiftWorkItems(user.id));
    });

    app.get('/api/workflow-templates', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        res.json(listWorkflowTemplates(user.id));
    });

    app.post('/api/workflow-templates', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;

        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
        const intent = typeof req.body?.intent === 'string' ? req.body.intent.trim() : '';

        if (!name || !description || !intent) {
            res.status(400).json({ message: 'name, description, and intent are required' });
            return;
        }

        res.status(201).json(createWorkflowTemplate({
            userId: user.id,
            name,
            description,
            intent,
            deliverToNotion: Boolean(req.body?.deliverToNotion),
            notifyInSlack: Boolean(req.body?.notifyInSlack),
        }));
    });

    app.delete('/api/workflow-templates/:id', (req: Request, res: Response) => {
        const user = requireAuth(req, res);
        if (!user) return;
        res.json({ success: deleteWorkflowTemplate(req.params.id, user.id) });
    });
}
