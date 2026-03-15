import { notifyTaskComplete, notifyTaskStarted } from './agentNotifier';
import { runAgentForRoutingDecision, AGENT_MANIFESTS } from './orchestratorAgents';
import {
  AgentTask,
  completeCancelledTask,
  createStepEmitter,
  createTask,
  emitTaskEvent,
  getTask,
  isCancellationRequested,
  listActiveTasks,
  listTasks,
  routeIntent,
  subscribeToTask,
  updateTask,
  cancelTask,
} from './orchestratorShared';
import { ingestAgentResult } from './memoryIngestor';
import type { SkillRunContext } from '../skills/types';
import { getSkill, runSkill } from '../skills/registry';
import { getSkillRouteType, type RuntimeRouteType } from './executionPolicy';
import { getTaskArtifact } from './taskArtifacts';

export { AGENT_MANIFESTS, cancelTask, createTask, getTask, listTasks, subscribeToTask };
export { listActiveTasks };
export type { AgentTask, AgentTaskStatus } from './orchestratorShared';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getResultSuccess(result: unknown): boolean {
  return asRecord(result)?.success !== false;
}

function getResultErrorMessage(result: unknown): string {
  const record = asRecord(result);
  if (!record) {
    return 'Task reported an unsuccessful result.';
  }

  const error = typeof record.error === 'string' ? record.error.trim() : '';
  if (error) {
    return error;
  }

  const summary = typeof record.summary === 'string' ? record.summary.trim() : '';
  if (summary) {
    return summary;
  }

  const message = typeof record.message === 'string' ? record.message.trim() : '';
  if (message) {
    return message;
  }

  const output = asRecord(record.output);
  const outputError = typeof output?.error === 'string' ? output.error.trim() : '';
  if (outputError) {
    return outputError;
  }

  return 'Task reported an unsuccessful result.';
}

function getTaskIdentifier(task: AgentTask): string {
  return task.workspaceTaskId ?? task.id;
}

function logTaskFailure(taskId: string, errorMessage: string, error: unknown): void {
  console.error(`[orchestrator] Task ${taskId} failed: ${errorMessage}`, error);
}

function notifyCompletion(
  userId: string,
  task: AgentTask,
  status: 'completed' | 'failed',
  data: { result?: unknown; error?: string; steps: AgentTask['steps']; completedAt: string },
  label: string,
): void {
  void notifyTaskComplete(userId, {
    ...task,
    status,
    steps: data.steps,
    completedAt: data.completedAt,
    ...(data.result !== undefined && { result: data.result }),
    ...(data.error && { error: data.error }),
  }).catch((err) => console.error(`[agentNotifier] ${label} notification failed:`, err));
}

function emitRunningStatus(task: AgentTask, agentId: string, routing?: { agent: string; confidence: number; reasoning: string }): void {
  emitTaskEvent(task.id, {
    type: 'status',
    taskId: task.workspaceTaskId,
    taskRunId: task.id,
    status: 'running',
    agentId,
    routeType: task.routeType,
    ...(routing ? { routing } : {}),
  });
}

function emitTerminalTaskEvent(task: AgentTask, type: 'completed' | 'failed', payload: { result?: unknown; error?: string; steps: unknown[] }): void {
  const artifact = getTaskArtifact(payload.result ?? task.result, task.steps);
  console.log(JSON.stringify({
    source: 'orchestrator',
    eventType: `task.${type}`,
    timestamp: new Date().toISOString(),
    taskId: task.workspaceTaskId ?? task.id,
    taskRunId: task.id,
    agentId: task.agentId,
    routeType: task.routeType,
    delegatedSkillId: task.delegatedSkillId ?? null,
    error: payload.error ?? null,
    totalSteps: payload.steps.length,
    hasResult: payload.result !== undefined,
    artifactKind: artifact?.kind ?? null,
    artifactSource: artifact?.source ?? null,
    hasArtifactUrl: Boolean(artifact?.url),
  }));
  emitTaskEvent(task.id, {
    type,
    taskId: task.workspaceTaskId,
    taskRunId: task.id,
    routeType: task.routeType,
    ...payload,
    totalSteps: payload.steps.length,
  });
}

async function runDelegatedSkillTask(
  task: AgentTask,
  ctx: SkillRunContext,
  skillId: string,
  args: Record<string, unknown>,
): Promise<void> {
  const skill = getSkill(skillId);
  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  const { emitStep, getSteps } = createStepEmitter(task);
  emitRunningStatus(task, task.agentId);
  notifyTaskStarted(ctx.userId, { ...task, status: 'running' });
  emitStep('routing', `Delegating skill ${skillId}`, { detail: task.intent, skillId });

  try {
    emitStep('skill_call', `Running ${skillId}...`, { skillId });
    const startedAt = Date.now();
    const runRecord = await runSkill(skillId, {
      ...ctx,
      taskId: getTaskIdentifier(task),
      taskRunId: task.id,
      originType: task.originType,
      originRef: task.originRef,
    }, args);
    const result = runRecord.result;

    emitStep('skill_result', `${skillId} complete`, {
      skillId,
      durationMs: Date.now() - startedAt,
      success: result.success !== false,
      detail: typeof result.message === 'string' ? result.message : undefined,
    });

    if (isCancellationRequested(task.id)) {
      completeCancelledTask(task, getSteps(), 'Cancelled by user');
      return;
    }

    const success = result.success !== false;
    emitStep('done', success ? `${skill.name} completed` : `${skill.name} halted — see details`, { success });
    const steps = getSteps();
    if (typeof result.message === 'string' && steps.length > 0) {
      steps[steps.length - 1] = { ...steps[steps.length - 1], detail: result.message };
    }

    if (!success) {
      const errorMessage = getResultErrorMessage(result);
      const completedAt = new Date().toISOString();
      updateTask(task.id, {
        userId: task.userId,
        status: 'failed',
        result,
        error: errorMessage,
        completedAt,
      }, steps);
      emitTerminalTaskEvent(task, 'failed', { result, error: errorMessage, steps });
      notifyCompletion(ctx.userId, task, 'failed', { result, error: errorMessage, steps, completedAt }, 'skill failure');
      return;
    }

    const completedAt = new Date().toISOString();
    updateTask(task.id, {
      userId: task.userId,
      status: 'completed',
      result,
      completedAt,
    }, steps);
    emitTerminalTaskEvent(task, 'completed', { result, steps });
    notifyCompletion(ctx.userId, task, 'completed', { result, steps, completedAt }, 'skill completion');
  } catch (error) {
    if (isCancellationRequested(task.id)) {
      completeCancelledTask(task, getSteps(), 'Cancelled by user');
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();
    const steps = getSteps();
    emitStep('error', `Failed: ${errorMessage}`, { success: false, skillId });
    updateTask(task.id, {
      userId: task.userId,
      status: 'failed',
      error: errorMessage,
      completedAt,
    }, steps);
    emitTerminalTaskEvent(task, 'failed', { error: errorMessage, steps });
    notifyCompletion(ctx.userId, task, 'failed', { error: errorMessage, steps, completedAt }, 'skill error');
  }
}

export async function delegateSkillExecution(
  skillId: string,
  ctx: SkillRunContext,
  args: Record<string, unknown>,
  options?: { intent?: string; originType?: AgentTask['originType']; originRef?: string },
): Promise<{ taskId: string; routeType: RuntimeRouteType }> {
  const skill = getSkill(skillId);
  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  const routeType = getSkillRouteType(skill, 'async');
  const intent = options?.intent ?? `Run ${skill.name}`;
  const task = createTask('skill-registry', intent, ctx, {
    routeType,
    delegatedSkillId: skillId,
    delegatedSkillArgs: args,
    originType: options?.originType ?? 'app',
    originRef: options?.originRef,
  });

  void runDelegatedSkillTask(task, ctx, skillId, args);
  return { taskId: getTaskIdentifier(task), routeType };
}

export async function orchestrate(
  intent: string,
  ctx: SkillRunContext,
): Promise<{ taskId: string; result?: unknown; routeType: RuntimeRouteType }> {
  const initialRouting = await routeIntent(intent, ctx.userId);
  const agentId = initialRouting.agent === 'skill' ? 'skill-registry' : `crewmate-${initialRouting.agent}-agent`;
  const task = createTask(agentId, intent, ctx, {
    routeType: initialRouting.routeType ?? (initialRouting.agent === 'skill' ? 'delegated_skill' : 'delegated_agent'),
  });
  const { emitStep, getSteps } = createStepEmitter(task);

  async function runOrchestratedTask(): Promise<void> {
    // Allow confidence threshold override — use let so we can reassign
    let routing = initialRouting;

    updateTask(task.id, { userId: task.userId, status: 'running' });
    notifyTaskStarted(ctx.userId, { ...task, status: 'running' });
    emitRunningStatus(task, agentId, {
      agent: routing.agent,
      confidence: routing.confidence,
      reasoning: routing.reasoning,
    });
    // Low-confidence routing falls back to research agent (safest default)
    if (routing.confidence < 0.55 && routing.agent !== 'research') {
      emitStep('thinking', `Low confidence routing (${routing.confidence}) — defaulting to research agent`, {
        detail: routing.reasoning,
      });
      routing = { ...routing, agent: 'research', routeType: 'delegated_agent' };
    }

    emitStep('routing', `Routing to ${routing.agent === 'skill' ? `skill: ${routing.skillId}` : `${routing.agent} agent`}`, {
      detail: routing.reasoning,
    });

    try {
      if (isCancellationRequested(task.id)) {
        completeCancelledTask(task, getSteps(), 'Cancelled by user');
        return;
      }

      let result: unknown;
      if (routing.agent === 'skill' && routing.skillId) {
        emitStep('skill_call', `Running ${routing.skillId}...`, { skillId: routing.skillId });
        const startedAt = Date.now();
        const runRecord = await runSkill(routing.skillId, {
          ...ctx,
          taskId: getTaskIdentifier(task),
          originType: task.originType,
          originRef: task.originRef,
        }, routing.skillArgs ?? {});
        result = runRecord.result;
        emitStep('skill_result', `${routing.skillId} complete`, {
          skillId: routing.skillId,
          durationMs: Date.now() - startedAt,
          success: (result as { success?: boolean }).success !== false,
        });
      } else {
        result = await runAgentForRoutingDecision(routing, intent, ctx, emitStep);
      }

      if (isCancellationRequested(task.id)) {
        completeCancelledTask(task, getSteps(), 'Cancelled by user');
        return;
      }

      const completedAt = new Date().toISOString();
      const steps = getSteps();
      const success = getResultSuccess(result);

      if (!success) {
        const errorMessage = getResultErrorMessage(result);
        updateTask(task.id, {
          userId: task.userId,
          status: 'failed',
          result,
          error: errorMessage,
          completedAt,
        }, steps);
        emitTerminalTaskEvent(task, 'failed', { result, error: errorMessage, steps });
        notifyCompletion(ctx.userId, task, 'failed', { result, error: errorMessage, steps, completedAt }, 'failure');
        return;
      }

      updateTask(task.id, {
        userId: task.userId,
        status: 'completed',
        result,
        completedAt,
      }, steps);
      ingestAgentResult({
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        agentId: routing.agent,
        intent,
        result,
        taskId: getTaskIdentifier(task),
        originType: task.originType,
        originRef: task.originRef,
      });
      emitTerminalTaskEvent(task, 'completed', { result, steps });
      notifyCompletion(ctx.userId, task, 'completed', { result, steps, completedAt }, 'success');
    } catch (error) {
      if (isCancellationRequested(task.id)) {
        completeCancelledTask(task, getSteps(), 'Cancelled by user');
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      const completedAt = new Date().toISOString();
      const steps = getSteps();
      logTaskFailure(task.id, errorMessage, error);
      emitStep('error', `Failed: ${errorMessage}`, { success: false });
      updateTask(task.id, {
        userId: task.userId,
        status: 'failed',
        error: errorMessage,
        completedAt,
      }, steps);
      emitTerminalTaskEvent(task, 'failed', { error: errorMessage, steps });
      notifyCompletion(ctx.userId, task, 'failed', { error: errorMessage, steps, completedAt }, 'failure');
    }
  }

  void runOrchestratedTask();

  return { taskId: getTaskIdentifier(task), routeType: task.routeType };
}
