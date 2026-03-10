import type { Skill } from '../types';
import { createClickUpTask } from '../../services/clickupService';

export const clickupCreateTaskSkill: Skill = {
    id: 'clickup.create-task',
    name: 'Create ClickUp Task',
    description: 'Create a ticket, bug report, or to-do in ClickUp. Use when the user asks to log a task, track a bug, or create any work item.',
    version: '1.0.0',
    category: 'productivity',
    personas: ['developer', 'marketer', 'founder', 'sales', 'designer'],
    requiresIntegration: ['clickup'],
    triggerPhrases: [
        'Create a ClickUp task for this',
        'Log this bug in ClickUp',
        'Add a to-do for this',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Task title' },
            description: { type: 'string', description: 'Detailed task description' },
        },
        required: ['name'],
    },
    handler: async (ctx, args) => {
        const result = await createClickUpTask(ctx.workspaceId, {
            name: String(args.name ?? ''),
            description: String(args.description ?? ''),
        });
        return {
            success: true,
            output: result,
            message: `✅ ClickUp task "${result.name}" created (${result.url})`,
        };
    },
};
