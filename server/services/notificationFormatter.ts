import type { AgentStepEvent } from '../types/agentEvents';
import type { AgentTask } from './orchestrator';
import { getArtifactFromResult, getTaskArtifact } from './taskArtifacts';

type NotificationVisualType = 'success' | 'info' | 'warning' | 'default';

interface NotificationDraft {
  title: string;
  message: string;
  type: NotificationVisualType;
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function buildArtifactMessage(artifact: { label: string; url?: string }): string {
  if (artifact.url) {
    return `Created "${artifact.label}". Open here: ${artifact.url}`;
  }

  return `Created "${artifact.label}".`;
}

function buildArtifactTitle(kind: 'notion' | 'clickup' | 'workspace' | 'generic'): string {
  switch (kind) {
    case 'notion':
      return 'Notion page created';
    case 'clickup':
      return 'ClickUp task created';
    case 'workspace':
      return 'Workspace task created';
    default:
      return 'Task complete';
  }
}

export function buildToolExecutionNotification(toolName: string, result: unknown): NotificationDraft | null {
  const artifact = getArtifactFromResult(result);
  if (artifact) {
    return {
      title: buildArtifactTitle(artifact.kind),
      message: buildArtifactMessage(artifact),
      type: 'success',
    };
  }

  const payload = asRecord(result);
  const message = getString(payload?.message);
  if (!message) {
    return null;
  }

  return {
    title: `${toolName.replace(/_/g, ' ')} complete`,
    message,
    type: 'success',
  };
}

export function buildTaskNotification(task: AgentTask): NotificationDraft {
  if (task.status === 'failed') {
    return {
      title: 'Task failed',
      message: task.error ? task.error.slice(0, 140) : task.intent.slice(0, 100),
      type: 'warning',
    };
  }

  const artifact = getTaskArtifact(task.result, task.steps as AgentStepEvent[] | undefined);
  if (artifact) {
    return {
      title: buildArtifactTitle(artifact.kind),
      message: buildArtifactMessage(artifact),
      type: 'success',
    };
  }

  const payload = asRecord(task.result);
  const summary = getString(payload?.summary) ?? getString(payload?.message);

  return {
    title: 'Task complete',
    message: summary ?? `${task.intent.slice(0, 100)}${task.intent.length > 100 ? '…' : ''}`,
    type: 'success',
  };
}
