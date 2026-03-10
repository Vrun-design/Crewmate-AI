/**
 * Agent Notifier — Phase 15 (fixed types)
 *
 * Called by the orchestrator when a task completes or fails.
 * Dispatches to configured channels:
 *   1. In-app notification (always) via createNotification + broadcastEvent
 *   2. Slack webhook (if slackWebhookUrl is set in notification prefs)
 */
import { createNotification } from './notificationService';
import { getNotificationPrefs } from './notificationPrefsService';
import type { AgentTask } from './orchestrator';

const SLACK_WEBHOOK_TIMEOUT_MS = 8_000;

// ── In-app notification ───────────────────────────────────────────────────────

function buildInApp(task: AgentTask): {
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'default';
} {
    if (task.status === 'completed') {
        return {
            title: `✅ Task complete`,
            message: `${task.intent.slice(0, 80)}${task.intent.length > 80 ? '…' : ''}`,
            type: 'success',
        };
    }
    if (task.status === 'failed') {
        return {
            title: `❌ Task failed`,
            message: task.error ? task.error.slice(0, 120) : task.intent.slice(0, 80),
            type: 'warning',
        };
    }
    return { title: `ℹ️ Task update`, message: task.intent.slice(0, 80), type: 'info' };
}

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
        console.error(`[agentNotifier] Slack webhook returned ${resp.status}: ${errText}`);
    }
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function notifyTaskComplete(userId: string, task: AgentTask): Promise<void> {
    // 1. Always create in-app notification
    try {
        const inApp = buildInApp(task);
        createNotification(userId, {
            title: inApp.title,
            message: inApp.message,
            type: inApp.type,
            sourcePath: `/agents?task=${task.id}`,
        });
    } catch (err) {
        console.error('[agentNotifier] in-app notification failed:', err);
    }

    // 2. Load user notification preferences
    let prefs;
    try {
        prefs = getNotificationPrefs(userId);
    } catch {
        return; // no prefs configured → only in-app
    }

    // 3. Check per-event toggles
    if (task.status === 'completed' && !prefs.notifyOnSuccess) return;
    if (task.status === 'failed' && !prefs.notifyOnError) return;

    // 4. Slack webhook
    if (prefs.slackWebhookUrl) {
        try {
            await sendSlackWebhook(prefs.slackWebhookUrl, task);
        } catch (err) {
            console.error('[agentNotifier] Slack webhook failed:', err);
        }
    }
}
