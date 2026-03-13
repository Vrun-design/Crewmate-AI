/**
 * Zapier Skills — "Connect Any Tool" bridge
 *
 * zapier.trigger:    Fire a named Zapier automation via webhook POST
 * zapier.list:       List all configured named Zap automations
 *
 * One Zapier webhook URL = access to 5,000+ apps (Airtable, HubSpot,
 * WhatsApp, Google Sheets, Stripe, Trello, and more).
 *
 * Setup: User creates a "Catch Hook" Zap at zapier.com, copies the
 * webhook URL, and saves it in Crewmate's Zapier integration settings.
 * Named automations let users configure multiple Zap URLs with aliases
 * so the agent can route to the right one ("save-lead", "notify-team", etc.)
 */
import type { Skill } from '../types';
import { getEffectiveIntegrationConfig } from '../../services/integrationConfigService';

const ZAPIER_TIMEOUT_MS = 15_000;

// ── Core webhook caller ───────────────────────────────────────────────────────

async function callZapierWebhook(
    webhookUrl: string,
    payload: Record<string, unknown>,
): Promise<{ success: boolean; status: number; message: string }> {
    if (!webhookUrl.startsWith('https://')) {
        throw new Error('Zapier webhook URL must start with https://');
    }

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source: 'crewmate',
            timestamp: new Date().toISOString(),
            ...payload,
        }),
        signal: AbortSignal.timeout(ZAPIER_TIMEOUT_MS),
    });

    const responseText = await response.text().catch(() => '');
    return {
        success: response.ok,
        status: response.status,
        message: response.ok
            ? `Zapier automation triggered successfully (${response.status})`
            : `Zapier returned ${response.status}: ${responseText.slice(0, 200)}`,
    };
}

// ── Named Zap resolution ──────────────────────────────────────────────────────

function resolveWebhookUrl(ctx: { workspaceId: string }, automationName?: string): string {
    const config = getEffectiveIntegrationConfig(ctx.workspaceId, 'zapier');

    // Try named automation first (e.g. "save-lead" → config["save-lead-url"])
    if (automationName) {
        const normalised = automationName.toLowerCase().replace(/\s+/g, '-');
        const namedUrl = config[`${normalised}-url`] ?? config[normalised];
        if (namedUrl) return namedUrl;
    }

    // Fall back to default webhook URL
    const defaultUrl = config['webhookUrl'] ?? config['defaultWebhookUrl'];
    if (defaultUrl) return defaultUrl;

    throw new Error(
        'No Zapier webhook URL configured. Go to Integrations → Zapier and add a webhook URL.',
    );
}

// ── Exported skills ───────────────────────────────────────────────────────────

export const zapierTriggerSkill: Skill = {
    id: 'zapier.trigger',
    name: 'Trigger Zap Automation',
    description:
        'Trigger any Zapier automation (Zap) with custom data. ' +
        'Connects to 5,000+ apps: Airtable, HubSpot, Google Sheets, WhatsApp, Stripe, Trello, and more. ' +
        'Use when the user wants to "save this to my CRM", "log this to a spreadsheet", ' +
        '"send a WhatsApp message", or trigger any workflow automation.',
    version: '1.0.0',
    category: 'automation',
    requiresIntegration: ['zapier'],
    triggerPhrases: [
        'Trigger a Zap automation',
        'Send this to Zapier',
        'Log this to my CRM',
        'Save this lead to Airtable',
        'Send a WhatsApp message via Zapier',
        'Run my automation',
        'Fire the workflow',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {
            automation: {
                type: 'string',
                description: 'Name of the automation to trigger (e.g. "save-lead", "notify-team"). Omit to use the default webhook.',
            },
            data: {
                type: 'string',
                description: 'JSON string of data to send to Zapier. Example: {"name":"Jane","email":"jane@acme.com"}',
            },
            summary: {
                type: 'string',
                description: 'Human-readable summary of what this trigger is doing (shown in step timeline).',
            },
        },
        required: [],
    },
    handler: async (ctx, args) => {
        const automation = typeof args.automation === 'string' ? args.automation : undefined;
        const summary = typeof args.summary === 'string' ? args.summary : 'Triggering Zap automation';

        // data arrives as a JSON string (JSONSchema doesn't support object properties)
        let data: Record<string, unknown> = {};
        if (typeof args.data === 'string' && args.data.trim()) {
            try { data = JSON.parse(args.data); } catch { /* ignore parse errors — send empty payload */ }
        } else if (args.data && typeof args.data === 'object') {
            data = args.data as Record<string, unknown>;
        }

        let webhookUrl: string;
        try {
            webhookUrl = resolveWebhookUrl(ctx, automation);
        } catch (err) {
            return { success: false, message: String(err) };
        }

        try {
            const result = await callZapierWebhook(webhookUrl, {
                automation: automation ?? 'default',
                summary,
                ...data,
            });

            return {
                success: result.success,
                output: { automation, status: result.status, summary },
                message: result.success
                    ? `⚡ ${result.message}\n\nAutomation: **${automation ?? 'default'}**\nData sent: ${JSON.stringify(data, null, 2).slice(0, 300)}`
                    : `❌ ${result.message}`,
            };
        } catch (err) {
            return {
                success: false,
                message: `Zapier trigger failed: ${String(err)}`,
            };
        }
    },
};

export const zapierListSkill: Skill = {
    id: 'zapier.list',
    name: 'List Zap Automations',
    description:
        'List all configured Zapier automation names available to trigger. ' +
        'Use when the user asks "what automations do I have?" or "what can I trigger?"',
    version: '1.0.0',
    category: 'automation',
    requiresIntegration: ['zapier'],
    triggerPhrases: [
        'What Zap automations do I have?',
        'List my Zapier workflows',
        'What can I trigger?',
        'Show my automations',
    ],
    preferredModel: 'quick',
    inputSchema: {
        type: 'object',
        properties: {},
        required: [],
    },
    handler: async (ctx, _args) => {
        const config = getEffectiveIntegrationConfig(ctx.workspaceId, 'zapier');

        const automations: string[] = [];
        if (config['webhookUrl'] || config['defaultWebhookUrl']) {
            automations.push('default (main automation)');
        }

        // Find named automations — keys ending in "-url" are named zaps
        for (const key of Object.keys(config)) {
            if (key.endsWith('-url') && key !== 'webhookUrl') {
                automations.push(key.replace(/-url$/, ''));
            }
        }

        if (automations.length === 0) {
            return {
                success: false,
                message: 'No Zapier automations configured. Go to Integrations → Zapier to add webhook URLs.',
            };
        }

        const list = automations.map(a => `• \`${a}\``).join('\n');
        return {
            success: true,
            output: { automations },
            message: `⚡ **Configured Zapier automations:**\n\n${list}\n\nUse \`zapier.trigger\` with the automation name to fire them.`,
        };
    },
};
