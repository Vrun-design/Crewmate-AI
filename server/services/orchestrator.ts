/**
 * A2A Orchestrator — Phase 11 (Inline agents + sub-step SSE streaming)
 *
 * Architecture:
 *   1. Classify intent via Gemini Flash
 *   2. Call the right specialist agent INLINE (same process — no HTTP hops)
 *   3. Each agent emits typed step events via emitStep callback → pushed to SSE
 *   4. User sees every skill call, result, and reasoning step in real-time
 *
 * Agent communication model:
 *   Agents → emitStep → orchestrator → SSE → UI
 *   Agents NEVER message the user directly. Only the orchestrator does.
 */
import { createGeminiClient } from './geminiClient';
import { serverConfig } from '../config';
import type { SkillRunContext } from '../skills/types';
import { listSkills, runSkill } from '../skills/registry';
import { db } from '../db';
import type { AgentStepEvent, AgentStepType, EmitStep } from '../types/agentEvents';
import { runResearchAgent, RESEARCH_AGENT_MANIFEST } from './agents/researchAgent';
import { runContentAgent, CONTENT_AGENT_MANIFEST } from './agents/contentAgent';
import { runDevOpsAgent, DEVOPS_AGENT_MANIFEST } from './agents/devOpsAgent';
import { runCommunicationsAgent, COMMS_AGENT_MANIFEST } from './agents/communicationsAgent';
import { runCalendarAgent, CALENDAR_AGENT_MANIFEST } from './agents/calendarAgent';
import { runSalesAgent, SALES_AGENT_MANIFEST } from './agents/salesAgent';
import { runMarketingAgent, MARKETING_AGENT_MANIFEST } from './agents/marketingAgent';
import { runProductAgent, PRODUCT_AGENT_MANIFEST } from './agents/productAgent';
import { runHRAgent, HR_AGENT_MANIFEST } from './agents/hrAgent';
import { runSupportAgent, SUPPORT_AGENT_MANIFEST } from './agents/supportAgent';
import { runSocialAgent, SOCIAL_AGENT_MANIFEST } from './agents/socialAgent';
import { runFinanceAgent, FINANCE_AGENT_MANIFEST } from './agents/financeAgent';
import { runLegalAgent, LEGAL_AGENT_MANIFEST } from './agents/legalAgent';
import { runDataAgent, DATA_AGENT_MANIFEST } from './agents/dataAgent';
import { notifyTaskComplete } from './agentNotifier';

// ── Task record types ─────────────────────────────────────────────────────────

export type AgentTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface AgentTask {
    id: string;
    agentId: string;
    intent: string;
    status: AgentTaskStatus;
    result?: unknown;
    error?: string;
    steps?: AgentStepEvent[];
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

// Ensure tables
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_tasks (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    intent TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    result_json TEXT,
    error TEXT,
    steps_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  )
`);

// ── SSE event listeners ───────────────────────────────────────────────────────

const taskListeners = new Map<string, Array<(event: string) => void>>();

export function subscribeToTask(taskId: string, listener: (event: string) => void): () => void {
    if (!taskListeners.has(taskId)) taskListeners.set(taskId, []);
    taskListeners.get(taskId)!.push(listener);
    return () => {
        const list = taskListeners.get(taskId) ?? [];
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
    };
}

function emitTaskEvent(taskId: string, event: object): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const listener of taskListeners.get(taskId) ?? []) listener(payload);
}

// ── Task persistence ──────────────────────────────────────────────────────────

export function createTask(agentId: string, intent: string): AgentTask {
    const task: AgentTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentId,
        intent,
        status: 'queued',
        steps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    db.prepare(`INSERT INTO agent_tasks (id, agent_id, intent, status, steps_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(task.id, task.agentId, task.intent, task.status, '[]', task.createdAt, task.updatedAt);
    return task;
}

export function getTask(id: string): AgentTask | null {
    const row = db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return rowToTask(row);
}

export function listTasks(limit = 20): AgentTask[] {
    const rows = db.prepare('SELECT * FROM agent_tasks ORDER BY created_at DESC LIMIT ?').all(limit) as Record<string, unknown>[];
    return rows.map(rowToTask);
}

function rowToTask(row: Record<string, unknown>): AgentTask {
    return {
        id: String(row.id),
        agentId: String(row.agent_id),
        intent: String(row.intent),
        status: String(row.status) as AgentTaskStatus,
        result: row.result_json ? JSON.parse(String(row.result_json)) as unknown : undefined,
        error: row.error ? String(row.error) : undefined,
        steps: row.steps_json ? JSON.parse(String(row.steps_json)) as AgentStepEvent[] : [],
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        completedAt: row.completed_at ? String(row.completed_at) : undefined,
    };
}

function updateTask(id: string, patch: Partial<AgentTask>, steps?: AgentStepEvent[]): void {
    const now = new Date().toISOString();
    db.prepare(`
    UPDATE agent_tasks
    SET status = COALESCE(?, status),
        result_json = COALESCE(?, result_json),
        error = COALESCE(?, error),
        steps_json = COALESCE(?, steps_json),
        completed_at = COALESCE(?, completed_at),
        updated_at = ?
    WHERE id = ?
  `).run(
        patch.status ?? null,
        patch.result !== undefined ? JSON.stringify(patch.result) : null,
        patch.error ?? null,
        steps ? JSON.stringify(steps) : null,
        patch.completedAt ?? null,
        now,
        id,
    );
}

// ── Agent registry (manifests for the UI) ────────────────────────────────────

export const AGENT_MANIFESTS = [
    // Original 5
    RESEARCH_AGENT_MANIFEST,
    CONTENT_AGENT_MANIFEST,
    DEVOPS_AGENT_MANIFEST,
    COMMS_AGENT_MANIFEST,
    CALENDAR_AGENT_MANIFEST,
    // Phase 12 workforce expansion
    SALES_AGENT_MANIFEST,
    MARKETING_AGENT_MANIFEST,
    PRODUCT_AGENT_MANIFEST,
    HR_AGENT_MANIFEST,
    SUPPORT_AGENT_MANIFEST,
    SOCIAL_AGENT_MANIFEST,
    FINANCE_AGENT_MANIFEST,
    LEGAL_AGENT_MANIFEST,
    DATA_AGENT_MANIFEST,
];

// ── Intent routing via Gemini Flash ──────────────────────────────────────────

interface RoutingDecision {
    agent: 'research' | 'content' | 'devops' | 'communications' | 'calendar'
    | 'sales' | 'marketing' | 'product' | 'hr' | 'support' | 'social'
    | 'finance' | 'legal' | 'data' | 'skill';
    skillId?: string;
    confidence: number;
    reasoning: string;
}

async function routeIntent(intent: string): Promise<RoutingDecision> {
    const ai = createGeminiClient();
    const skills = listSkills().map((s) => `${s.id}: ${s.description}`).join('\n');

    const response = await ai.models.generateContent({
        model: serverConfig.geminiOrchestrationModel,
        contents: `You are an intent router for a 14-agent AI workforce. Route the user's intent to the most appropriate agent or direct skill.

Agents:
- research: Deep research, market analysis, technical deep-dives, competitive intelligence
- content: Blog posts, articles, documentation, any long-form writing
- devops: Code review, GitHub, terminal commands, CI/CD, technical architecture
- communications: Email drafting, Slack messages, outreach sequences, follow-ups
- calendar: Scheduling, free time finding, meeting creation, agenda
- sales: Lead research, outreach emails, CRM, sales copy, pipeline
- marketing: Campaign briefs, A/B copy, marketing strategy, brand
- product: User stories, PRD, backlog, sprint planning, feature specs
- hr: Job descriptions, interviews, offer letters, onboarding, people ops
- support: Customer responses, ticket triage, FAQ, escalations, playbooks
- social: Tweet threads, LinkedIn posts, Instagram, social calendars
- finance: Invoices, expense reports, budgets, financial templates
- legal: Contract analysis, NDA review, compliance, policy drafts
- data: SQL queries, data analysis, metrics, KPI reports, data stories

Direct skills (for simple single atomic tasks):
${skills}

User intent: "${intent}"

Respond ONLY with valid JSON (no markdown, no explanation):
{"agent":"<agent_name or 'skill'>","skillId":"<skill id if skill route, else null>","confidence":0.9,"reasoning":"<1 sentence>"}`,

    });

    try {
        const text = (response.text ?? '').replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(text) as RoutingDecision;
    } catch {
        return { agent: 'research', confidence: 0.5, reasoning: 'Fallback to research agent' };
    }
}

// ── Main orchestration entry point ────────────────────────────────────────────

export async function orchestrate(
    intent: string,
    ctx: SkillRunContext,
): Promise<{ taskId: string; result?: unknown }> {
    // Classify intent
    const routing = await routeIntent(intent);
    const agentId = routing.agent === 'skill'
        ? 'skill-registry'
        : `crewmate-${routing.agent}-agent`;

    const task = createTask(agentId, intent);
    const steps: AgentStepEvent[] = [];
    let stepIndex = 0;

    // emitStep builder — each agent calls this
    const emitStep: EmitStep = (type: AgentStepType, label: string, options = {}) => {
        const step: AgentStepEvent = {
            taskId: task.id,
            stepIndex: stepIndex++,
            type,
            timestamp: new Date().toISOString(),
            label,
            detail: options.detail,
            skillId: options.skillId,
            durationMs: options.durationMs,
            success: options.success,
        };
        steps.push(step);
        // Emit to SSE immediately
        emitTaskEvent(task.id, { type: 'step', step });
    };

    // Run async in background
    void (async () => {
        updateTask(task.id, { status: 'running' });
        emitTaskEvent(task.id, {
            type: 'status',
            status: 'running',
            agentId,
            routing: { agent: routing.agent, confidence: routing.confidence, reasoning: routing.reasoning },
        });

        // Emit the routing step
        emitStep('routing', `Routing to ${routing.agent === 'skill' ? `skill: ${routing.skillId}` : `${routing.agent} agent`}`, {
            detail: routing.reasoning,
        });

        try {
            let result: unknown;

            if (routing.agent === 'skill' && routing.skillId) {
                emitStep('skill_call', `Running ${routing.skillId}...`, { skillId: routing.skillId });
                const t0 = Date.now();
                const runRecord = await runSkill(routing.skillId, ctx, {});
                result = runRecord.result;
                emitStep('skill_result', `${routing.skillId} complete`, {
                    skillId: routing.skillId,
                    durationMs: Date.now() - t0,
                    success: (result as { success?: boolean }).success !== false,
                });
            } else if (routing.agent === 'research') {
                result = await runResearchAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'content') {
                result = await runContentAgent(intent, ctx, emitStep, { researchFirst: true });
            } else if (routing.agent === 'devops') {
                result = await runDevOpsAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'communications') {
                result = await runCommunicationsAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'calendar') {
                result = await runCalendarAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'sales') {
                result = await runSalesAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'marketing') {
                result = await runMarketingAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'product') {
                result = await runProductAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'hr') {
                result = await runHRAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'support') {
                result = await runSupportAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'social') {
                result = await runSocialAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'finance') {
                result = await runFinanceAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'legal') {
                result = await runLegalAgent(intent, ctx, emitStep);
            } else if (routing.agent === 'data') {
                result = await runDataAgent(intent, ctx, emitStep);
            } else {
                // Fallback to research
                result = await runResearchAgent(intent, ctx, emitStep);
            }

            const doneTask = getTask(task.id);
            updateTask(task.id, { status: 'completed', result, completedAt: new Date().toISOString() }, steps);
            emitTaskEvent(task.id, { type: 'completed', result, steps, totalSteps: steps.length });
            // Fire notification (non-blocking)
            if (doneTask) void notifyTaskComplete(ctx.userId, { ...doneTask, status: 'completed', result, steps, completedAt: new Date().toISOString() });

        } catch (err) {
            emitStep('error', `Failed: ${String(err)}`, { success: false });
            updateTask(task.id, { status: 'failed', error: String(err), completedAt: new Date().toISOString() }, steps);
            emitTaskEvent(task.id, { type: 'failed', error: String(err), steps });
            // Fire notification (non-blocking)
            void notifyTaskComplete(ctx.userId, { ...task, status: 'failed', error: String(err), steps, completedAt: new Date().toISOString() });
        }
    })();

    return { taskId: task.id };
}
