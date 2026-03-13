import type { TaskDetailRecord, TaskRecord, TaskRunRecord } from '../types';

export interface SessionHistoryRecord {
  id: string;
  title: string;
  date: string;
  duration: string;
  tasks: number;
}

export interface TaskRow {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  time: string;
  tool: string;
  priority: string;
  url?: string | null;
  linkedAgentTaskId?: string | null;
  sourceKind?: string | null;
  currentRunId?: string | null;
  linkedSessionId?: string | null;
  artifactCount?: number | null;
}

export interface TaskRunRow {
  id: string;
  taskId: string;
  runType: string;
  agentId?: string | null;
  skillId?: string | null;
  status: string;
  stepsJson?: string | null;
  resultJson?: string | null;
  error?: string | null;
  originType?: string | null;
  originRef?: string | null;
  linkedAgentTaskId?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

export function formatSessionDate(startedAt: string): string {
  const date = new Date(startedAt);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDuration(startedAt: string, endedAt?: string | null): string {
  const startTime = new Date(startedAt).getTime();
  const endTime = endedAt ? new Date(endedAt).getTime() : Date.now();
  const durationSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

export function mapTaskRow(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status as TaskRecord['status'],
    time: row.time,
    tool: row.tool,
    priority: row.priority as TaskRecord['priority'],
    url: row.url ?? null,
    linkedAgentTaskId: row.linkedAgentTaskId ?? null,
    sourceKind: (row.sourceKind ?? 'manual') as TaskRecord['sourceKind'],
    currentRunId: row.currentRunId ?? null,
    linkedSessionId: row.linkedSessionId ?? null,
    artifactCount: row.artifactCount ?? 0,
  };
}

export function mapTaskRunRow(row: TaskRunRow): TaskRunRecord {
  return {
    id: row.id,
    taskId: row.taskId,
    runType: row.runType as TaskRunRecord['runType'],
    agentId: row.agentId ?? null,
    skillId: row.skillId ?? null,
    status: row.status as TaskRunRecord['status'],
    steps: row.stepsJson ? JSON.parse(row.stepsJson) as unknown[] : [],
    result: row.resultJson ? JSON.parse(row.resultJson) : undefined,
    error: row.error ?? null,
    originType: (row.originType ?? null) as TaskRunRecord['originType'],
    originRef: row.originRef ?? null,
    linkedAgentTaskId: row.linkedAgentTaskId ?? null,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? null,
  };
}

export function buildTaskDetailRecord(task: TaskRecord, runs: TaskRunRecord[]): TaskDetailRecord {
  const latestRun = task.currentRunId
    ? runs.find((run) => run.id === task.currentRunId) ?? runs[0] ?? null
    : runs[0] ?? null;

  return {
    ...task,
    latestRun,
    runs,
  };
}
