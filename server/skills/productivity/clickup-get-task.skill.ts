import type { Skill } from '../types';
import { getEffectiveIntegrationConfig } from '../../services/integrationConfigService';
import { isClickUpConfigured } from '../../services/clickupService';

interface ClickUpTaskDetail {
    id: string;
    name: string;
    description: string;
    status: string;
    priority: string;
    url: string;
    assignees: string[];
    due_date: string | null;
    comments: string[];
}

async function getClickUpTask(workspaceId: string, taskId: string): Promise<ClickUpTaskDetail> {
    const config = getEffectiveIntegrationConfig(workspaceId, 'clickup');
    const token = config.token ?? '';

    if (!isClickUpConfigured(workspaceId)) {
        throw new Error('ClickUp is not connected. Connect ClickUp from the Integrations page first.');
    }

    const response = await fetch(
        `https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}`,
        {
            headers: {
                Authorization: token,
                'Content-Type': 'application/json',
            },
        },
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`ClickUp get task failed: ${response.status} ${text}`);
    }

    const task = await response.json() as {
        id: string;
        name: string;
        description?: string;
        status: { status: string };
        priority: { priority: string } | null;
        url: string;
        assignees?: Array<{ username?: string; email?: string }>;
        due_date?: string | null;
    };

    // Fetch comments separately
    let comments: string[] = [];
    try {
        const commentsRes = await fetch(
            `https://api.clickup.com/api/v2/task/${encodeURIComponent(taskId)}/comment`,
            {
                headers: {
                    Authorization: token,
                    'Content-Type': 'application/json',
                },
            },
        );
        if (commentsRes.ok) {
            const commentsPayload = await commentsRes.json() as {
                comments?: Array<{ comment_text: string }>;
            };
            comments = (commentsPayload.comments ?? []).map((c) => c.comment_text).filter(Boolean);
        }
    } catch {
        // Comments are optional — ignore failures
    }

    return {
        id: task.id,
        name: task.name,
        description: task.description ?? '',
        status: task.status?.status ?? 'unknown',
        priority: task.priority?.priority ?? 'none',
        url: task.url,
        assignees: (task.assignees ?? []).map((a) => a.username ?? a.email ?? 'unknown'),
        due_date: task.due_date ? new Date(Number(task.due_date)).toISOString() : null,
        comments,
    };
}

export const clickupGetTaskSkill: Skill = {
    id: 'clickup.get-task',
    name: 'Get ClickUp Task Detail',
    description: 'Fetch full details for a specific ClickUp task by ID, including description, assignees, status, priority, due date, and comments.',
    version: '1.0.0',
    category: 'productivity',
    requiresIntegration: ['clickup'],
    triggerPhrases: [
        'Get details for ClickUp task',
        'Show me task details',
        'What is the status of task',
        'Look up ClickUp task',
    ],
    preferredModel: 'quick',
    executionMode: 'delegated',
    latencyClass: 'quick',
    sideEffectLevel: 'none',
    exposeInLiveSession: true,
    inputSchema: {
        type: 'object',
        properties: {
            taskId: {
                type: 'string',
                description: 'The ClickUp task ID to retrieve.',
            },
        },
        required: ['taskId'],
    },
    handler: async (ctx, args) => {
        const taskId = String(args.taskId ?? '');
        const task = await getClickUpTask(ctx.workspaceId, taskId);

        const lines: string[] = [
            `**${task.name}** (${task.id})`,
            `Status: ${task.status.toUpperCase()}`,
            `Priority: ${task.priority}`,
            task.assignees.length > 0 ? `Assignees: ${task.assignees.join(', ')}` : '',
            task.due_date ? `Due: ${task.due_date}` : '',
            task.description ? `\nDescription:\n${task.description}` : '',
            task.comments.length > 0 ? `\nComments (${task.comments.length}):\n${task.comments.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : '',
            `\nURL: ${task.url}`,
        ].filter(Boolean);

        return {
            success: true,
            output: task,
            message: lines.join('\n'),
        };
    },
};
