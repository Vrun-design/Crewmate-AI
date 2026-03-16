import type { Skill } from '../types';
import { attachFileToClickUpTask, createClickUpTask } from '../../services/clickupService';
import { getScreenshotArtifactBytesForUser, resolveRecentScreenshotArtifact } from '../../services/screenshotArtifactService';

export const clickupCreateTaskSkill: Skill = {
    id: 'clickup.create-task',
    name: 'Create ClickUp Task',
    description: 'Create a ticket, bug report, or to-do in ClickUp. Use when the user asks to log a task, track a bug, or create any work item.',
    version: '1.0.0',
    category: 'productivity',
    requiresIntegration: ['clickup'],
    triggerPhrases: [
        'Create a ClickUp task for this',
        'Log this bug in ClickUp',
        'Add a to-do for this',
    ],
    preferredModel: 'quick',
    executionMode: 'either',
    latencyClass: 'quick',
    sideEffectLevel: 'high',
    exposeInLiveSession: true,
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Task title — you must compose this yourself based on context. Never leave empty.' },
            description: { type: 'string', description: 'Detailed task description — compose from context, conversation, or screen content.' },
            screenshotArtifactId: { type: 'string', description: 'Optional screenshot artifact ID to attach to the ClickUp task after creation.' },
        },
        required: ['name'],
    },
    handler: async (ctx, args) => {
        const description = String(args.description ?? '').trim();
        const name = String(args.name ?? '').trim()
            || description.split('\n')[0].slice(0, 100).trim()
            || ctx.taskTitle?.replace(/^create clickup task:?\s*/i, '').trim()
            || '';
        if (!name) {
            throw new Error('Task name is required to create a ClickUp task.');
        }
        const result = await createClickUpTask(ctx.workspaceId, {
            name,
            description,
        });

        let attachmentUrl: string | undefined;
        if (typeof args.screenshotArtifactId === 'string' && args.screenshotArtifactId.trim()) {
            const screenshot = resolveRecentScreenshotArtifact(ctx.userId, {
                artifactId: args.screenshotArtifactId,
                sessionId: ctx.sessionId,
                taskId: ctx.taskId,
            });
            if (screenshot) {
                const file = getScreenshotArtifactBytesForUser(screenshot.id, ctx.userId);
                if (file) {
                    const attachment = await attachFileToClickUpTask(ctx.workspaceId, {
                        taskIdOrUrl: result.id,
                        fileName: file.fileName,
                        bytes: file.bytes,
                        mimeType: file.mimeType,
                    });
                    attachmentUrl = attachment.url || undefined;
                }
            }
        }
        return {
            success: true,
            output: {
                ...result,
                attachmentUrl,
            },
            message: attachmentUrl
                ? `✅ ClickUp task "${result.name}" created and screenshot attached (${result.url})`
                : `✅ ClickUp task "${result.name}" created (${result.url})`,
        };
    },
};
