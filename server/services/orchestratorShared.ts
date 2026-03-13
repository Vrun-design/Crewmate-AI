import { createGeminiClient } from './geminiClient';
import { serverConfig } from '../config';
import type { SkillRunContext } from '../skills/types';
import { getSkill, listSkillsForUser } from '../skills/registry';
import { db } from '../db';
import { isFeatureEnabled } from './featureFlagService';
import { getSkillRouteType, type RuntimeRouteType } from './executionPolicy';
import {
  cancelTaskRun,
  createTaskRun,
  createWorkspaceTask,
  getTaskByRunId,
  getTaskRecord,
  listActiveTaskRuns,
  listTaskRunsForUser,
  updateWorkspaceTask,
  updateTaskRun,
} from '../repositories/workspaceRepository';
import type { AgentStepEvent, AgentStepType, EmitStep } from '../types/agentEvents';
import type { TaskRecord, TaskRunRecord } from '../types';
import { extractLinkedSessionId } from './channelTasking';

export type AgentTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AgentTask {
  id: string;
  taskId?: string;
  agentId: string;
  routeType: RuntimeRouteType;
  userId: string;
  workspaceId: string;
  intent: string;
  status: AgentTaskStatus;
  delegatedSkillId?: string;
  delegatedSkillArgs?: Record<string, unknown>;
  originType?: 'app' | 'live_session' | 'command' | 'slack' | 'email' | 'system';
  originRef?: string;
  workspaceTaskId?: string;
  taskRunId?: string;
  cancelRequested?: boolean;
  result?: unknown;
  error?: string;
  steps?: AgentStepEvent[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface RoutingDecision {
  routeType?: RuntimeRouteType;
  agent: 'research' | 'content' | 'devops' | 'communications'
  | 'sales' | 'marketing' | 'product' | 'hr' | 'support' | 'social'
  | 'finance' | 'legal' | 'data' | 'ui_navigator' | 'skill';
  skillId?: string;
  confidence: number;
  reasoning: string;
}

const taskListeners = new Map<string, Array<(event: string) => void>>();

export function subscribeToTask(taskId: string, listener: (event: string) => void): () => void {
  if (!taskListeners.has(taskId)) {
    taskListeners.set(taskId, []);
  }

  taskListeners.get(taskId)!.push(listener);
  return () => {
    const listeners = taskListeners.get(taskId) ?? [];
    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  };
}

export function emitTaskEvent(taskId: string, event: object): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const listener of taskListeners.get(taskId) ?? []) {
    listener(payload);
  }
}

export function createStepEmitter(task: AgentTask): { emitStep: EmitStep; getSteps: () => AgentStepEvent[] } {
  const steps: AgentStepEvent[] = [];
  let stepIndex = 0;

  const emitStep: EmitStep = (type: AgentStepType, label: string, options = {}) => {
    const step: AgentStepEvent = {
      taskId: task.workspaceTaskId ?? task.id,
      taskRunId: task.id,
      stepIndex: stepIndex += 1,
      type,
      timestamp: new Date().toISOString(),
      label,
      detail: options.detail,
      skillId: options.skillId,
      durationMs: options.durationMs,
      success: options.success,
    };

    step.stepIndex -= 1;
    steps.push(step);
    emitTaskEvent(task.id, { type: 'step', step });
  };

  return {
    emitStep,
    getSteps: () => steps,
  };
}

function mapAgentStatusToWorkspaceStatus(status: AgentTaskStatus): 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' {
  if (status === 'queued') {
    return 'pending';
  }

  if (status === 'running') {
    return 'in_progress';
  }

  return status;
}

function formatSkillLabel(skillId?: string | null): string {
  if (!skillId) {
    return 'Crewmate';
  }

  return skillId
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getWorkspaceToolLabel(
  routeType: RuntimeRouteType,
  delegatedSkillId?: string,
  originType?: AgentTask['originType'],
): string {
  if (routeType === 'delegated_skill' && delegatedSkillId) {
    const [provider] = delegatedSkillId.split('.');
    return provider.charAt(0).toUpperCase() + provider.slice(1);
  }

  return originType === 'live_session' ? 'Crewmate Live' : 'Crewmate';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function unwrapResult(result: unknown): Record<string, unknown> | null {
  const record = asRecord(result);
  if (!record) {
    return null;
  }

  return asRecord(record.output) ?? record;
}

function getWorkspaceTaskPatchFromResult(task: AgentTask, result: unknown): Partial<TaskRecord> {
  const payload = unwrapResult(result);
  const tool = getWorkspaceToolLabel(task.routeType, task.delegatedSkillId, task.originType);
  const baseDescription = task.routeType === 'delegated_skill'
    ? `${formatSkillLabel(task.delegatedSkillId)} completed in the background.`
    : 'Background workflow completed.';

  if (!payload) {
    return { tool, description: baseDescription };
  }

  const screenshot = asRecord(payload.screenshot);
  const url = getString(payload.url) ?? getString(payload.publicUrl) ?? getString(screenshot?.publicUrl);
  const title = getString(payload.title) ?? getString(payload.name);
  const message = getString(asRecord(result)?.message);

  return {
    tool,
    url: url ?? undefined,
    description: message ?? baseDescription,
    title: title && task.routeType === 'delegated_skill' && task.delegatedSkillId === 'notion.create-page'
      ? title
      : undefined,
    artifactCount: url ? 1 : undefined,
  };
}

function toAgentTaskStatus(status: TaskRunRecord['status']): AgentTaskStatus {
  return status;
}

export function buildAgentTaskFromRun(
  run: TaskRunRecord,
  taskTitle?: string | null,
  userId = '',
  workspaceId = '',
): AgentTask {
  return {
    id: run.id,
    taskId: run.taskId,
    agentId: run.agentId ?? (run.runType === 'delegated_skill' ? 'skill-registry' : 'crewmate'),
    routeType: run.runType === 'delegated_agent' ? 'delegated_agent' : 'delegated_skill',
    userId,
    workspaceId,
    intent: taskTitle?.trim() || 'Background task',
    status: toAgentTaskStatus(run.status),
    delegatedSkillId: run.skillId ?? undefined,
    originType: run.originType === 'app' || run.originType === 'live_session' || run.originType === 'command' || run.originType === 'slack' || run.originType === 'email' || run.originType === 'system'
      ? run.originType
      : undefined,
    originRef: run.originRef ?? undefined,
    workspaceTaskId: run.taskId,
    taskRunId: run.id,
    cancelRequested: run.status === 'cancelled',
    result: run.result,
    error: run.error ?? undefined,
    steps: (run.steps as AgentStepEvent[]) ?? [],
    createdAt: run.startedAt,
    updatedAt: run.completedAt ?? run.startedAt,
    completedAt: run.completedAt ?? undefined,
  };
}

export function createTask(
  agentId: string,
  intent: string,
  ctx: Pick<SkillRunContext, 'userId' | 'workspaceId'>,
  options?: {
    routeType?: RuntimeRouteType;
    delegatedSkillId?: string;
    delegatedSkillArgs?: Record<string, unknown>;
    originType?: AgentTask['originType'];
    originRef?: string;
    workspaceTaskId?: string;
    taskRunId?: string;
  },
): AgentTask {
  const createdAt = new Date().toISOString();
  const routeType = options?.routeType ?? 'delegated_agent';
  const workspaceTask = createWorkspaceTask(ctx.userId, {
    title: intent.length > 96 ? `${intent.slice(0, 93).trim()}...` : intent,
    description: routeType === 'delegated_skill'
      ? `${formatSkillLabel(options?.delegatedSkillId)} started in the background.`
      : 'Background workflow started by Crewmate.',
    tool: getWorkspaceToolLabel(routeType, options?.delegatedSkillId, options?.originType),
    priority: 'Medium',
    status: mapAgentStatusToWorkspaceStatus('queued'),
    sourceKind: 'delegated',
    linkedSessionId: extractLinkedSessionId(options?.originType, options?.originRef),
  });
  const taskRun = createTaskRun({
    taskId: workspaceTask.id,
    userId: ctx.userId,
    workspaceId: ctx.workspaceId,
    runType: routeType === 'delegated_skill' ? 'delegated_skill' : 'delegated_agent',
    agentId,
    skillId: options?.delegatedSkillId,
    status: 'queued',
    originType: options?.originType ?? null,
    originRef: options?.originRef ?? null,
    startedAt: createdAt,
  });

  updateWorkspaceTask(workspaceTask.id, ctx.userId, {
    currentRunId: taskRun.id,
    url: `/tasks?task=${workspaceTask.id}`,
  });

  return {
    ...buildAgentTaskFromRun(taskRun, intent, ctx.userId, ctx.workspaceId),
    delegatedSkillArgs: options?.delegatedSkillArgs,
  };
}

export function getTask(id: string, userId?: string): AgentTask | null {
  if (!userId) {
    return null;
  }

  const detail = getTaskByRunId(id, userId);
  const run = detail?.runs.find((candidate) => candidate.id === id);
  if (!detail || !run) {
    return null;
  }

  return buildAgentTaskFromRun(run, detail.title, userId);
}

export function listTasks(userId: string, limit = 20): AgentTask[] {
  return listTaskRunsForUser(userId, {
    limit,
    includeRunTypes: ['delegated_skill', 'delegated_agent'],
  }).map((run) => {
    const task = getTaskRecord(run.taskId, userId);
    return buildAgentTaskFromRun(run, task?.title, userId);
  });
}

export function listActiveTasks(userId: string, limit = 6): AgentTask[] {
  return listActiveTaskRuns(userId, limit).map((run) => {
    const task = getTaskRecord(run.taskId, userId);
    return buildAgentTaskFromRun(run, task?.title, userId);
  });
}

export function updateTask(id: string, patch: Partial<AgentTask>, steps?: AgentStepEvent[]): void {
  if (!patch.userId) {
    return;
  }

  const task = getTask(id, patch.userId);
  if (!task?.taskId) {
    return;
  }

  updateTaskRun(id, patch.userId, {
    status: patch.status,
    completedAt: patch.completedAt ?? null,
    result: patch.result,
    error: patch.error ?? null,
    steps: steps ?? task.steps ?? [],
  });

  if (patch.status) {
    const resultPatch = patch.result ? getWorkspaceTaskPatchFromResult(task, patch.result) : {};
    updateWorkspaceTask(task.taskId, patch.userId, {
      status: mapAgentStatusToWorkspaceStatus(patch.status),
      currentRunId: id,
      linkedSessionId: extractLinkedSessionId(task.originType, task.originRef),
      ...resultPatch,
    });
  }
}

export function isCancellationRequested(taskId: string): boolean {
  const row = db.prepare('SELECT status FROM task_runs WHERE id = ? LIMIT 1').get(taskId) as { status?: string } | undefined;
  return row?.status === 'cancelled';
}

export function completeCancelledTask(task: AgentTask, steps: AgentStepEvent[], detail?: string): void {
  updateTask(task.id, {
    userId: task.userId,
    status: 'cancelled',
    error: detail ?? 'Cancelled by user',
    cancelRequested: true,
    completedAt: new Date().toISOString(),
  }, steps);
  emitTaskEvent(task.id, {
    type: 'cancelled',
    taskId: task.taskId,
    taskRunId: task.id,
    error: detail ?? 'Cancelled by user',
    steps,
    routeType: task.routeType,
  });
}

export function cancelTask(taskId: string, userId: string): AgentTask | null {
  const task = getTask(taskId, userId);
  if (!task) {
    return null;
  }

  const steps = [...(task.steps ?? [])];
  steps.push({
    taskId: task.taskId ?? taskId,
    taskRunId: taskId,
    stepIndex: steps.length,
    type: 'error',
    timestamp: new Date().toISOString(),
    label: 'Task cancelled by user',
    detail: 'Crewmate stopped tracking further work on this task.',
    success: false,
  });

  cancelTaskRun(taskId, userId, 'Cancelled by user');
  emitTaskEvent(taskId, {
    type: 'cancelled',
    taskId: task.taskId,
    taskRunId: taskId,
    error: 'Cancelled by user',
    steps,
    routeType: task.routeType,
  });
  return getTask(taskId, userId);
}

export async function routeIntent(intent: string, userId: string): Promise<RoutingDecision> {
  if (isFeatureEnabled('uiNavigator')) {
    const lowerIntent = intent.toLowerCase();
    const looksLikeUiNavigatorRequest = lowerIntent.includes('ui navigator')
      || lowerIntent.includes('start url:')
      || /\b(click|fill|type into|press|scroll|open the site|navigate the ui|use the website)\b/.test(lowerIntent);

    if (looksLikeUiNavigatorRequest) {
      return {
        routeType: 'delegated_agent',
        agent: 'ui_navigator',
        confidence: 0.95,
        reasoning: 'Intent explicitly references browser UI navigation or direct on-page interaction.',
      };
    }
  }

  const ai = createGeminiClient();
  const skills = listSkillsForUser(userId).map((skill) => `${skill.id}: ${skill.description}`).join('\n');
  const response = await ai.models.generateContent({
    model: serverConfig.geminiOrchestrationModel,
    contents: `You are an intent router for a 14-agent AI workforce. Route the user's intent to the most appropriate agent or direct skill.

Agents:
- research: Deep research, market analysis, technical deep-dives, competitive intelligence
- content: Blog posts, articles, documentation, any long-form writing
- devops: Code review, terminal commands, CI/CD, technical architecture
- communications: Message drafting, Slack messages, outreach sequences, follow-ups
- sales: Lead research, outreach emails, CRM, sales copy, pipeline
- marketing: Campaign briefs, A/B copy, marketing strategy, brand
- product: User stories, PRD, backlog, sprint planning, feature specs
- hr: Job descriptions, interviews, offer letters, onboarding, people ops
- support: Customer responses, ticket triage, FAQ, escalations, playbooks
- social: Tweet threads, LinkedIn posts, Instagram, social calendars
- finance: Invoices, expense reports, budgets, financial templates
- legal: Contract analysis, NDA review, compliance, policy drafts
- data: SQL queries, data analysis, metrics, KPI reports, data stories
- ui_navigator: Visual browser interaction, clicking, typing, scrolling, and navigating website UIs

Direct skills (for simple single atomic tasks):
${skills}

User intent: "${intent}"

Respond ONLY with valid JSON (no markdown, no explanation):
{"agent":"<agent_name or 'skill'>","skillId":"<skill id if skill route, else null>","confidence":0.9,"reasoning":"<1 sentence>"}`,
  });

  try {
    const text = (response.text ?? '').replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(text) as RoutingDecision;
    if (parsed.agent === 'skill' && parsed.skillId) {
      const skill = getSkill(parsed.skillId);
      return {
        ...parsed,
        routeType: skill ? getSkillRouteType(skill, 'async') : 'delegated_skill',
      };
    }

    return {
      ...parsed,
      routeType: 'delegated_agent',
    };
  } catch {
    return {
      routeType: 'delegated_agent',
      agent: 'research',
      confidence: 0.5,
      reasoning: 'Fallback to research agent',
    };
  }
}
