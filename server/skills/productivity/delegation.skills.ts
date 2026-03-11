import type { Skill } from '../types';
import { enqueueResearchBriefJob, enqueueWorkflowRunJob } from '../../services/delegationService';

export const delegationQueueWorkflowSkill: Skill = {
  id: 'delegation.queue-workflow',
  name: 'Queue Background Workflow',
  description: 'Queue a background workflow for asynchronous execution. Use when the user asks you to handle something later, off-shift, in the background, or deliver the result after the live session ends.',
  version: '1.0.0',
  category: 'productivity',
  personas: ['founder', 'developer', 'marketer', 'sales'],
  requiresIntegration: [],
  triggerPhrases: [
    'Handle this in the background',
    'Do this after the call',
    'Queue this for off-shift execution',
    'Work on this and send me the result later',
  ],
  preferredModel: 'orchestration',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short job title for the queued workflow' },
      intent: { type: 'string', description: 'Detailed instruction for the background workflow' },
      deliverToNotion: { type: 'boolean', description: 'Whether to save the result into Notion if connected' },
      notifyInSlack: { type: 'boolean', description: 'Whether to send a Slack update when the job completes if Slack is connected' },
    },
    required: ['intent'],
  },
  handler: async (ctx, args) => {
    const intent = String(args.intent ?? '').trim();
    if (!intent) {
      return { success: false, error: 'intent is required' };
    }

    const job = enqueueWorkflowRunJob(
      ctx.workspaceId,
      ctx.userId,
      {
        title: String(args.title ?? (intent.slice(0, 80) || 'Background workflow')),
        intent,
        deliverToNotion: Boolean(args.deliverToNotion),
        notifyInSlack: Boolean(args.notifyInSlack),
      },
      {
        actor: 'live session',
        handoffSummary: 'Queued from live session',
        originRef: ctx.sessionId ?? null,
        originType: 'live_session',
      },
    );

    return {
      success: true,
      output: { jobId: job.id, title: job.title, status: job.status },
      message: `Queued "${job.title}" for background execution.`,
    };
  },
};

export const delegationQueueResearchSkill: Skill = {
  id: 'delegation.queue-research-brief',
  name: 'Queue Research Brief',
  description: 'Queue a structured background research brief. Use when the user asks for competitive analysis, market research, or a research memo to be delivered later.',
  version: '1.0.0',
  category: 'productivity',
  personas: ['founder', 'marketer', 'sales', 'developer'],
  requiresIntegration: [],
  triggerPhrases: [
    'Research this in the background',
    'Prepare a research brief',
    'Do a competitor analysis and send it later',
  ],
  preferredModel: 'research',
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Research topic or company space to analyze' },
      goal: { type: 'string', description: 'Specific output goal for the research brief' },
      audience: { type: 'string', description: 'Who the research is for, such as founders or PMs' },
      deliverToNotion: { type: 'boolean', description: 'Whether to save the result into Notion if connected' },
      notifyInSlack: { type: 'boolean', description: 'Whether to send a Slack update when the job completes if Slack is connected' },
    },
    required: ['topic', 'goal'],
  },
  handler: async (ctx, args) => {
    const topic = String(args.topic ?? '').trim();
    const goal = String(args.goal ?? '').trim();
    if (!topic || !goal) {
      return { success: false, error: 'topic and goal are required' };
    }

    const job = enqueueResearchBriefJob(
      ctx.workspaceId,
      ctx.userId,
      {
        topic,
        goal,
        audience: String(args.audience ?? 'team').trim() || 'team',
        deliverToNotion: Boolean(args.deliverToNotion),
        notifyInSlack: Boolean(args.notifyInSlack),
      },
      {
        actor: 'live session',
        handoffSummary: 'Queued from live session',
        originRef: ctx.sessionId ?? null,
        originType: 'live_session',
      },
    );

    return {
      success: true,
      output: { jobId: job.id, topic: job.title, status: job.status },
      message: `Queued research brief "${job.title}" for background execution.`,
    };
  },
};
