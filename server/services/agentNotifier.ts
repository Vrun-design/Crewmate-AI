/**
 * Agent Notifier — Phase 15 (fixed types)
 *
 * Called by the orchestrator when a task completes or fails.
 * Dispatches to configured channels:
 *   1. In-app notification (always) via createNotification + broadcastEvent
 *   2. Slack webhook (if slackWebhookUrl is set in notification prefs)
 */
import { createNotification } from './notificationService';
import { buildTaskNotification } from './notificationFormatter';
import { getNotificationPrefs } from './notificationPrefsService';
import type { AgentTask } from './orchestrator';
import { db } from '../db';
import { postSlackMessage } from './slackService';
import { broadcastEvent } from './eventService';
import { parseReplyTarget } from './channelTasking';
import { serverConfig } from '../config';
import { logServerError } from './runtimeLogger';
import { announceLiveTaskUpdate } from './liveGatewayAnnouncements';
import { getTaskArtifact } from './taskArtifacts';

const SLACK_WEBHOOK_TIMEOUT_MS = 8_000;
type LiveTaskUpdateStatus = 'running' | 'completed' | 'failed';

function getWorkspaceIdForUser(userId: string): string | null {
    const row = db.prepare('SELECT workspace_id as workspaceId FROM workspace_members WHERE user_id = ? LIMIT 1').get(userId) as { workspaceId: string } | undefined;
    return row?.workspaceId ?? null;
}

function buildTaskLink(taskId: string): string {
    return `${new URL('/tasks', 'http://placeholder').pathname}?task=${encodeURIComponent(taskId)}`;
}

function buildPublicTaskUrl(taskId: string): string {
    return new URL(buildTaskLink(taskId), serverConfig.publicWebAppUrl).toString();
}

function buildChannelCompletionMessage(task: AgentTask): string {
    const notification = buildTaskNotification(task);
    const lines = [
        notification.title,
        notification.message,
        `Open: ${buildPublicTaskUrl(task.taskId ?? task.id)}`,
    ];
    return lines.join('\n');
}

function getReplyTargetSessionId(task: AgentTask): string {
    const replyTarget = parseReplyTarget(task.originRef);
    return replyTarget?.channel === 'live_session' ? replyTarget.sessionId : '';
}

function broadcastLiveTaskUpdate(
    userId: string,
    task: AgentTask,
    status: LiveTaskUpdateStatus,
    summary: string | null,
    sessionId?: string,
): void {
    broadcastEvent(userId, 'live_task_update', {
        sessionId: sessionId ?? getReplyTargetSessionId(task),
        taskId: task.taskId ?? task.id,
        taskRunId: task.id,
        agentId: task.agentId,
        title: task.intent,
        status,
        summary,
    });
}

// ── In-app notification ───────────────────────────────────────────────────────

// ── Slack Block Kit webhook ───────────────────────────────────────────────────

async function sendSlackWebhook(webhookUrl: string, task: AgentTask): Promise<void> {
    const isSuccess = task.status === 'completed';
    const emoji = isSuccess ? '✅' : '❌';
    const color = isSuccess ? '#36a64f' : '#e53e3e';

    const stepLines = (task.steps ?? [])
        .filter((s) => s.type !== 'routing')
        .slice(-5)
        .map((s) => `• ${s.label}`)
        .join('\n');

    const durationText = (() => {
        if (!task.completedAt) return '';
        const ms = new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime();
        return `${Math.round(ms / 1000)}s`;
    })();

    const body = {
        attachments: [
            {
                color,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `${emoji} *Crewmate Task ${isSuccess ? 'Complete' : 'Failed'}*\n>${task.intent.slice(0, 120)}${task.intent.length > 120 ? '…' : ''}`,
                        },
                    },
                    ...(stepLines ? [{
                        type: 'section',
                        text: { type: 'mrkdwn', text: `*Steps executed:*\n${stepLines}` },
                    }] : []),
                    {
                        type: 'context',
                        elements: [{
                            type: 'mrkdwn',
                            text: [
                                task.agentId ? `Agent: *${task.agentId.replace('crewmate-', '').replace('-agent', '')}*` : null,
                                durationText ? `Duration: ${durationText}` : null,
                                task.error ? `Error: ${task.error.slice(0, 80)}` : null,
                            ].filter(Boolean).join('  ·  '),
                        }],
                    },
                ],
            },
        ],
    };

    const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(SLACK_WEBHOOK_TIMEOUT_MS),
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => 'unknown');
        logServerError('agentNotifier:slack-webhook-response', new Error(`Slack webhook returned ${resp.status}: ${errText}`), {
            status: resp.status,
            taskId: task.taskId ?? task.id,
        });
    }
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

/**
 * Broadcast a live_task_update with status 'running' immediately when a task starts.
 * This gives the frontend an immediate "agent is working" signal regardless of origin.
 */
export function notifyTaskStarted(userId: string, task: AgentTask): void {
    try {
        broadcastLiveTaskUpdate(userId, task, 'running', null);
    } catch (err) {
        logServerError('agentNotifier:task-started', err, { userId, taskId: task.taskId ?? task.id });
    }
}

export async function notifyTaskComplete(userId: string, task: AgentTask): Promise<void> {
    // 1. Load user notification preferences
    let prefs;
    try {
        prefs = getNotificationPrefs(userId);
    } catch (error) {
        logServerError('agentNotifier:get-notification-prefs', error, { userId });
        prefs = {
            notifyOnSuccess: true,
            notifyOnError: true,
            inAppEnabled: true,
        };
    }

    // 2. Always create in-app notification unless the user disabled it
    if (prefs.inAppEnabled) {
        try {
    const inApp = buildTaskNotification(task);
    const artifact = getTaskArtifact(task.result, task.steps);
            createNotification(userId, {
                title: inApp.title,
                message: inApp.message,
                type: inApp.type,
                sourcePath: `/tasks?task=${task.taskId ?? task.id}`,
            });
            console.log(JSON.stringify({
                source: 'agentNotifier',
                eventType: 'task.notification',
                timestamp: new Date().toISOString(),
                taskId: task.taskId ?? task.id,
                taskRunId: task.id,
                status: task.status,
                artifactKind: artifact?.kind ?? null,
                artifactSource: artifact?.source ?? null,
                hasArtifactUrl: Boolean(artifact?.url),
            }));
        } catch (err) {
            logServerError('agentNotifier:in-app', err, { userId, taskId: task.taskId ?? task.id });
        }
    }

    // 3. Check per-event toggles
    if (task.status === 'completed' && !prefs.notifyOnSuccess) return;
    if (task.status === 'failed' && !prefs.notifyOnError) return;

    const replyTarget = parseReplyTarget(task.originRef);
    const workspaceId = getWorkspaceIdForUser(userId);

    if (replyTarget?.channel === 'slack' && workspaceId) {
        try {
            await postSlackMessage(workspaceId, {
                channelId: replyTarget.channelId,
                threadTs: replyTarget.threadTs ?? undefined,
                text: buildChannelCompletionMessage(task),
            });
        } catch (err) {
            logServerError('agentNotifier:slack-completion', err, { userId, workspaceId, taskId: task.taskId ?? task.id });
        }
        return;
    }

    // Always broadcast completion via SSE so the Dashboard can show the notification,
    // regardless of whether the task originated from a live session or the app UI.
    const payload = buildTaskNotification(task);
    const artifact = getTaskArtifact(task.result, task.steps);
    broadcastLiveTaskUpdate(
        userId,
        task,
        task.status === 'failed' ? 'failed' : 'completed',
        payload.message,
        replyTarget?.channel === 'live_session' ? replyTarget.sessionId : undefined,
    );
    if (replyTarget?.channel === 'live_session') {
        announceLiveTaskUpdate(replyTarget.sessionId, task, payload.message);
        console.log(JSON.stringify({
            source: 'agentNotifier',
            eventType: 'task.live_announcement',
            timestamp: new Date().toISOString(),
            taskId: task.taskId ?? task.id,
            taskRunId: task.id,
            sessionId: replyTarget.sessionId,
            status: task.status,
            artifactKind: artifact?.kind ?? null,
            artifactSource: artifact?.source ?? null,
            hasArtifactUrl: Boolean(artifact?.url),
            dispatched: true,
        }));
        return;
    }

    console.log(JSON.stringify({
        source: 'agentNotifier',
        eventType: 'task.live_announcement',
        timestamp: new Date().toISOString(),
        taskId: task.taskId ?? task.id,
        taskRunId: task.id,
        sessionId: null,
        status: task.status,
        artifactKind: artifact?.kind ?? null,
        artifactSource: artifact?.source ?? null,
        hasArtifactUrl: Boolean(artifact?.url),
        dispatched: false,
    }));

    if (prefs.slackWebhookUrl) {
        try {
            await sendSlackWebhook(prefs.slackWebhookUrl, task);
        } catch (err) {
            logServerError('agentNotifier:slack-webhook', err, { userId, taskId: task.taskId ?? task.id });
        }
    }
}
