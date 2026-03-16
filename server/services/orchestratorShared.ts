import { createGeminiClient } from './geminiClient';
import { serverConfig } from '../config';
import type { SkillRunContext } from '../skills/types';
import { formatSkillForRouting } from '../skills/framework';
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
import { getTaskArtifact } from './taskArtifacts';

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
  skillArgs?: Record<string, unknown> | null;
  confidence: number;
  reasoning: string;
}

const taskListeners = new Map<string, Array<(event: string) => void>>();

function logTaskEvent(eventType: string, payload: Record<string, unknown>): void {
  console.log(JSON.stringify({
    source: 'orchestrator',
    eventType,
    timestamp: new Date().toISOString(),
    ...payload,
  }));
}

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
  // Snapshot the listener list — a listener may unsubscribe itself during iteration
  // (e.g. pipelineOrchestrator's waitForTask) which would otherwise corrupt the for-of iterator.
  const listeners = [...(taskListeners.get(taskId) ?? [])];
  for (const listener of listeners) {
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
      stepIndex: stepIndex++,
      type,
      timestamp: new Date().toISOString(),
      label,
      detail: options.detail,
      skillId: options.skillId,
      durationMs: options.durationMs,
      success: options.success,
      screenshotUrl: options.screenshotUrl,
      currentUrl: options.currentUrl,
      url: options.url,
    };

    steps.push(step);
    logTaskEvent('task.step', {
      taskId: task.workspaceTaskId ?? task.id,
      taskRunId: task.id,
      agentId: task.agentId,
      routeType: task.routeType,
      originType: task.originType ?? null,
      delegatedSkillId: task.delegatedSkillId ?? null,
      stepIndex: step.stepIndex,
      stepType: type,
      label,
      detail: options.detail ?? null,
      skillId: options.skillId ?? null,
      durationMs: options.durationMs ?? null,
      success: options.success ?? null,
      currentUrl: options.currentUrl ?? null,
    });
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

function getWorkspaceTaskPatchFromResult(task: AgentTask, result: unknown): Partial<TaskRecord> {
  const artifact = getTaskArtifact(result, task.steps);
  const tool = getWorkspaceToolLabel(task.routeType, task.delegatedSkillId, task.originType);
  const baseDescription = task.routeType === 'delegated_skill'
    ? `${formatSkillLabel(task.delegatedSkillId)} completed in the background.`
    : 'Background workflow completed.';
  const message = (() => {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      return null;
    }
    const record = result as Record<string, unknown>;
    return typeof record.message === 'string' && record.message.trim() ? record.message.trim() : null;
  })();

  return {
    tool,
    url: artifact?.url ?? undefined,
    description: message ?? baseDescription,
    title: artifact?.label && task.routeType === 'delegated_skill' && task.delegatedSkillId === 'notion.create-page'
      ? artifact.label
      : undefined,
    artifactCount: artifact?.url ? 1 : undefined,
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

  const task = {
    ...buildAgentTaskFromRun(taskRun, intent, ctx.userId, ctx.workspaceId),
    delegatedSkillArgs: options?.delegatedSkillArgs,
  };

  logTaskEvent('task.created', {
    taskId: task.workspaceTaskId ?? task.id,
    taskRunId: task.id,
    agentId: task.agentId,
    routeType: task.routeType,
    userId: task.userId,
    workspaceId: task.workspaceId,
    originType: task.originType ?? null,
    delegatedSkillId: task.delegatedSkillId ?? null,
    intent: task.intent,
  });

  return task;
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

  if (patch.status || patch.error || patch.completedAt || patch.result !== undefined) {
    logTaskEvent('task.updated', {
      taskId: task.taskId,
      taskRunId: id,
      agentId: task.agentId,
      routeType: task.routeType,
      status: patch.status ?? task.status,
      error: patch.error ?? null,
      completedAt: patch.completedAt ?? null,
      hasResult: patch.result !== undefined,
      totalSteps: steps?.length ?? task.steps?.length ?? 0,
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
  logTaskEvent('task.cancelled', {
    taskId: task.taskId ?? task.id,
    taskRunId: task.id,
    agentId: task.agentId,
    routeType: task.routeType,
    error: detail ?? 'Cancelled by user',
    totalSteps: steps.length,
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
  logTaskEvent('task.cancelled', {
    taskId: task.taskId ?? taskId,
    taskRunId: taskId,
    agentId: task.agentId,
    routeType: task.routeType,
    error: 'Cancelled by user',
    totalSteps: steps.length,
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
  // Exclude live-session bridge skills — they require an active live session and sessionId,
  // so they cannot be called from the async orchestrator context.
  const skills = listSkillsForUser(userId)
    .filter((skill) => !skill.id.startsWith('live.'))
    .map((skill) => formatSkillForRouting(skill))
    .join('\n\n');
  const response = await ai.models.generateContent({
    model: serverConfig.geminiOrchestrationModel,
    contents: `You are an intent router for a 14-agent AI workforce. Route the user's intent to the most appropriate agent or direct skill.

CRITICAL ROUTING RULES:
1. A direct skill route is ONLY appropriate for ATOMIC tasks where all required data is already present in the intent (e.g. "Create a folder called Marketing", "List my calendar events").
2. If the task requires research, analysis, or data gathering BEFORE a creation step, ALWAYS route to an AGENT — never a direct skill. The agent will gather the data and call the creation skill itself.
3. If the intent combines any of (research/analyse/analyze/find/compare/look up) WITH any of (create/sheet/spreadsheet/slides/presentation/deck/doc/document), it is a COMPOUND intent — route to an agent, never a direct skill.

Agents:
- research: Deep research, market analysis, technical deep-dives, competitive intelligence. Also handles: research + create sheet/slides/doc compound requests.
- content: Blog posts, articles, documentation, any long-form writing
- devops: Code review, terminal commands, CI/CD, technical architecture
- communications: Message drafting, Slack messages, outreach sequences, follow-ups
- sales: Lead research, outreach emails, CRM, sales copy, pipeline
- marketing: Campaign briefs, A/B copy, marketing strategy, brand
- product: User stories, PRD, backlog, sprint planning, feature specs
- hr: Job descriptions, interviews, offer letters, onboarding, people ops
- support: Customer responses, ticket triage, FAQ, escalations, playbooks
- social: Tweet threads, LinkedIn posts, Instagram, social calendars
- finance: Invoices, expense reports, budgets, financial templates, stock/market analysis. Also handles: finance + create sheet/slides compound requests.
- legal: Contract analysis, NDA review, compliance, policy drafts
- data: SQL queries, data analysis, metrics, KPI reports, data stories. Also handles: data + create sheet/slides compound requests.
- ui_navigator: Visual browser interaction, clicking, typing, scrolling, and navigating website UIs

Direct skills (only for simple single atomic tasks where no prior research or generation is needed):
${skills}

User intent: "${intent}"

Respond ONLY with valid JSON (no markdown, no explanation):
{"agent":"<agent_name or 'skill'>","skillId":"<skill id if skill route, else null>","skillArgs":<for skill routes: object with args extracted from intent such as {"title":"..."} — for agent routes: null>,"confidence":0.9,"reasoning":"<1 sentence>"}

For skillArgs: extract the most obvious args from the intent. For google.sheets-create-spreadsheet extract {"title":"<title>"}. For google.docs-create-document extract {"title":"<title>"}. For google.calendar-create-event extract date/time/title details. For other skills use {}.`,
  });

  try {
    const text = (response.text ?? '').replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(text) as RoutingDecision;
    if (parsed.agent === 'skill' && parsed.skillId) {
      const skill = getSkill(parsed.skillId);
      if (!skill) {
        // Router hallucinated a skill that doesn't exist — fall through to research agent
        return {
          routeType: 'delegated_agent',
          agent: 'research',
          confidence: 0.5,
          reasoning: `Skill "${parsed.skillId}" not found — fallback to research agent`,
        };
      }

      return {
        ...parsed,
        routeType: getSkillRouteType(skill, 'async'),
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
