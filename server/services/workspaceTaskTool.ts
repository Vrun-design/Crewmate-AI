import { Behavior } from '@google/genai';
import { registerTool } from '../mcp/mcpServer';
import { createWorkspaceTask } from '../repositories/workspaceRepository';

registerTool({
  name: 'create_workspace_task',
  description: 'Create a local task in the Crewmate workspace. Use this when the user asks to create a task, add a todo, or track an item but does NOT specify an external tool like ClickUp or Jira.',
  exposeInLiveSession: true,
  behavior: Behavior.NON_BLOCKING,
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Detailed task description' },
      priority: { type: 'string', enum: ['Low', 'Medium', 'High'], description: 'Task priority' },
    },
    required: ['title'],
  },
  handler: async (context, args) => {
    const title = typeof args.title === 'string' ? args.title : '';
    const description = typeof args.description === 'string' ? args.description : '';
    const priority = typeof args.priority === 'string' && ['Low', 'Medium', 'High'].includes(args.priority)
      ? args.priority as 'Low' | 'Medium' | 'High'
      : 'Medium';

    if (!title) {
      throw new Error('Task title is required');
    }

    const task = createWorkspaceTask(context.userId, {
      title,
      description,
      tool: 'Crewmate',
      priority,
    });

    return {
      success: true,
      task,
      message: `Task "${task.title}" created successfully in Crewmate.`,
    };
  },
});
