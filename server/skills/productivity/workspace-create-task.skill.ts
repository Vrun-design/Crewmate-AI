import type { Skill } from '../types';
import { createWorkspaceTask } from '../../repositories/workspaceRepository';

export const workspaceCreateTaskSkill: Skill = {
  id: 'workspace.create-task',
  name: 'Create Workspace Task',
  description: 'Create a local Crewmate task when the user wants to track a task without sending it to an external tool.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: [],
  triggerPhrases: [
    'Create a Crewmate task',
    'Track this as a task',
    'Add this to my local task list',
  ],
  preferredModel: 'quick',
  executionMode: 'either',
  latencyClass: 'quick',
  sideEffectLevel: 'low',
  exposeInLiveSession: true,
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Task details' },
      priority: { type: 'string', description: 'Priority: Low, Medium, or High', enum: ['Low', 'Medium', 'High'] },
    },
    required: ['title'],
  },
  handler: async (ctx, args) => {
    const title = String(args.title ?? '').trim();
    const description = String(args.description ?? '').trim();
    const priority = typeof args.priority === 'string' && ['Low', 'Medium', 'High'].includes(args.priority)
      ? args.priority as 'Low' | 'Medium' | 'High'
      : 'Medium';

    if (!title) {
      throw new Error('Task title is required');
    }

    const task = createWorkspaceTask(ctx.userId, {
      title,
      description,
      tool: 'Crewmate',
      priority,
    });

    return {
      success: true,
      output: task,
      message: `Workspace task "${task.title}" created`,
    };
  },
};
