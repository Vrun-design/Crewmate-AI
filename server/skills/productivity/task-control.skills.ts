import { Behavior } from '@google/genai';
import type { Skill } from '../types';
import { cancelTask } from '../../services/orchestrator';
import { getTaskDetail, listTasks as listUnifiedTasks } from '../../repositories/workspaceRepository';
import type { TaskDetailRecord, TaskRecord } from '../../types';

function normalizeQuery(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function isActiveTask(task: TaskRecord): boolean {
  return task.status === 'pending' || task.status === 'in_progress';
}

function getTaskSearchText(task: TaskRecord | TaskDetailRecord): string {
  return `${task.title} ${task.description ?? ''}`.trim().toLowerCase();
}

function sortTasksByRecency<T extends TaskRecord>(tasks: T[]): T[] {
  return [...tasks].sort((left, right) => {
    const leftTime = left.currentRunId ? 1 : 0;
    const rightTime = right.currentRunId ? 1 : 0;
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return right.id.localeCompare(left.id);
  });
}

function matchTasksForControl(input: {
  userId: string;
  sessionId?: string;
  taskId?: string;
  query?: string;
  scope?: 'current_session' | 'all_active';
}): TaskRecord[] {
  if (input.taskId) {
    const task = getTaskDetail(input.taskId, input.userId);
    return task && isActiveTask(task) ? [task] : [];
  }

  const scope = input.scope ?? 'current_session';
  const query = normalizeQuery(input.query);
  const tasks = sortTasksByRecency(
    listUnifiedTasks(input.userId).filter((task) => {
      if (!isActiveTask(task) || task.sourceKind !== 'delegated') {
        return false;
      }

      if (scope === 'current_session') {
        return Boolean(input.sessionId) && task.linkedSessionId === input.sessionId;
      }

      return true;
    }),
  );

  if (!query) {
    return tasks.slice(0, 5);
  }

  return tasks.filter((task) => getTaskSearchText(task).includes(query));
}

function formatTaskLabel(task: { id: string; title: string; status: string; sourceKind?: string }): string {
  return `${task.title} (${task.status}, ${task.sourceKind ?? 'manual'}) [${task.id}]`;
}

export const taskListActiveSkill: Skill = {
  id: 'tasks.list-active',
  name: 'List Active Tasks',
  description: 'List currently queued or running delegated tasks. Use when the user asks what is still running, what you started, or which background tasks are active.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: [],
  triggerPhrases: [
    'What tasks are still running?',
    'What background work is active?',
    'List my active tasks',
    'What did you start?',
  ],
  preferredModel: 'quick',
  executionMode: 'inline',
  latencyClass: 'quick',
  sideEffectLevel: 'none',
  exposeInLiveSession: true,
  liveFunctionBehavior: Behavior.NON_BLOCKING,
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        description: 'Use "current_session" to focus on tasks started from this live session, or "all_active" to include all active tasks.',
        enum: ['current_session', 'all_active'],
      },
      query: {
        type: 'string',
        description: 'Optional text filter over task intent, such as "research" or "notion".',
      },
    },
  },
  handler: async (ctx, args) => {
    const matches = matchTasksForControl({
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      query: typeof args.query === 'string' ? args.query : undefined,
      scope: args.scope === 'all_active' ? 'all_active' : 'current_session',
    });

    return {
      success: true,
      output: matches.map((task) => ({
        id: task.id,
        title: task.title,
        intent: task.title,
        status: task.status,
        sourceKind: task.sourceKind,
        currentRunId: task.currentRunId,
      })),
      message: matches.length > 0
        ? `Active tasks:\n${matches.map((task, index) => `${index + 1}. ${formatTaskLabel(task)}`).join('\n')}`
        : 'No active delegated tasks matched that request.',
    };
  },
};

export const taskCancelSkill: Skill = {
  id: 'tasks.cancel',
  name: 'Cancel Active Task',
  description: 'Cancel a queued or running delegated task. Use when the user says stop that task, cancel the background work, or stop what you just started.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: [],
  triggerPhrases: [
    'Stop that task',
    'Cancel that background task',
    'Stop what you just started',
    'Cancel the running task',
  ],
  preferredModel: 'quick',
  executionMode: 'inline',
  latencyClass: 'quick',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  liveFunctionBehavior: Behavior.NON_BLOCKING,
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string', description: 'Optional exact task id to cancel.' },
      query: { type: 'string', description: 'Optional phrase to match against the task intent, such as "research" or "the notion task".' },
      scope: {
        type: 'string',
        description: 'Use "current_session" to cancel something started from this live session, or "all_active" to search all active tasks.',
        enum: ['current_session', 'all_active'],
      },
    },
  },
  handler: async (ctx, args) => {
    const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : '';
    const query = typeof args.query === 'string' ? args.query : undefined;
    const matches = matchTasksForControl({
      userId: ctx.userId,
      sessionId: ctx.sessionId,
      taskId: taskId || undefined,
      query,
      scope: args.scope === 'all_active' ? 'all_active' : 'current_session',
    });

    if (matches.length === 0) {
      return {
        success: false,
        error: 'No matching active task found to cancel.',
      };
    }

    const shouldAutoPickLatest = !taskId && !normalizeQuery(query);
    if (matches.length > 1 && !shouldAutoPickLatest) {
      return {
        success: false,
        error: `Multiple active tasks matched. Be more specific.\n${matches.map((task, index) => `${index + 1}. ${formatTaskLabel(task)}`).join('\n')}`,
      };
    }

    const target = matches[0];
    const taskDetail = getTaskDetail(target.id, ctx.userId);
    const activeRunId = taskDetail?.runs.find((run) => run.status === 'queued' || run.status === 'running')?.id
      ?? taskDetail?.latestRun?.id
      ?? null;
    if (!activeRunId) {
      return {
        success: false,
        error: 'This task does not have a cancellable active run.',
      };
    }

    const cancelled = cancelTask(activeRunId, ctx.userId);
    if (!cancelled) {
      return {
        success: false,
        error: 'Task could not be cancelled.',
      };
    }

    return {
      success: true,
      output: {
        id: target.id,
        status: cancelled.status,
        title: taskDetail?.title ?? target.title,
      },
      message: `Cancelled task "${taskDetail?.title ?? target.title}".`,
    };
  },
};
