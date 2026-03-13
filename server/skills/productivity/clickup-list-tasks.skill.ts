import type { Skill } from '../types';
import { getEffectiveIntegrationConfig } from '../../services/integrationConfigService';
import { isClickUpConfigured } from '../../services/clickupService';

interface ClickUpTask {
    id: string;
    name: string;
    status: string;
    url: string;
    priority: string;
}

async function listClickUpTasks(workspaceId: string): Promise<ClickUpTask[]> {
    const config = getEffectiveIntegrationConfig(workspaceId, 'clickup');
    const token = config.token ?? '';
    const listId = config.defaultListId ?? config.listId ?? '';

    if (!isClickUpConfigured(workspaceId)) {
        throw new Error('ClickUp is not connected. Connect ClickUp from the Integrations page first.');
    }

    if (!listId) {
        throw new Error('ClickUp is connected, but no default list is selected yet. Choose one in Integrations first.');
    }

    const response = await fetch(
        `https://api.clickup.com/api/v2/list/${listId}/task?page=0&order_by=created&reverse=true&subtasks=false&include_closed=false`,
        {
            headers: {
                Authorization: token,
                'Content-Type': 'application/json',
            },
        },
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`ClickUp list tasks failed: ${response.status} ${text}`);
    }

    const payload = await response.json() as {
        tasks: Array<{
            id: string;
            name: string;
            status: { status: string };
            url: string;
            priority: { priority: string } | null;
        }>;
    };

    return (payload.tasks ?? []).map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status?.status ?? 'unknown',
        url: task.url,
        priority: task.priority?.priority ?? 'none',
    }));
}

export const clickupListTasksSkill: Skill = {
    id: 'clickup.list-tasks',
    name: 'List ClickUp Tasks',
    description: 'List tasks in the configured ClickUp list. Use when the user asks to see open tasks, check backlog, or get a task overview.',
    version: '1.0.0',
    category: 'productivity',
    requiresIntegration: ['clickup'],
    triggerPhrases: [
        'What tasks are in ClickUp?',
        'Show me the backlog',
        'List ClickUp tasks',
        'What is on our task list?',
    ],
    preferredModel: 'quick',
    executionMode: 'inline',
    latencyClass: 'quick',
    sideEffectLevel: 'none',
    exposeInLiveSession: true,
    inputSchema: {
        type: 'object',
        properties: {},
    },
    handler: async (ctx) => {
        const tasks = await listClickUpTasks(ctx.workspaceId);
        const summary = tasks.map((t) =>
            `• [${t.status.toUpperCase()}] "${t.name}"${t.priority !== 'none' ? ` (${t.priority} priority)` : ''} — ${t.url}`,
        ).join('\n');
        return {
            success: true,
            output: tasks,
            message: tasks.length > 0
                ? `✅ Found ${tasks.length} task(s):\n${summary}`
                : 'ℹ️ No open tasks found in the configured ClickUp list.',
        };
    },
};
