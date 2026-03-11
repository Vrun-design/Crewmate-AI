import type { AgentStepEvent } from '../types/agentEvents';
import type { AgentTask } from './orchestrator';

type NotificationVisualType = 'success' | 'info' | 'warning' | 'default';

interface ArtifactDescriptor {
  kind: 'notion' | 'github' | 'clickup' | 'workspace' | 'generic';
  label: string;
  url?: string;
}

interface NotificationDraft {
  title: string;
  message: string;
  type: NotificationVisualType;
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

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function unwrapResult(result: unknown): Record<string, unknown> | null {
  const record = asRecord(result);
  if (!record) {
    return null;
  }

  const nestedOutput = asRecord(record.output);
  return nestedOutput ?? record;
}

function buildArtifactMessage(artifact: ArtifactDescriptor): string {
  if (artifact.url) {
    return `Created "${artifact.label}". Open here: ${artifact.url}`;
  }

  return `Created "${artifact.label}".`;
}

function getArtifactFromResult(result: unknown): ArtifactDescriptor | null {
  const payload = unwrapResult(result);
  if (!payload) {
    return null;
  }

  const url = getString(payload.url);
  const title = getString(payload.title);
  const name = getString(payload.name);
  const issueNumber = getNumber(payload.issueNumber);
  const task = asRecord(payload.task);

  if (title && url?.includes('notion.so')) {
    return { kind: 'notion', label: title, url };
  }

  if (title && issueNumber !== null && url) {
    return { kind: 'github', label: `#${issueNumber} ${title}`, url };
  }

  if (name && url?.includes('clickup.com')) {
    return { kind: 'clickup', label: name, url };
  }

  if (task) {
    const taskTitle = getString(task.title);
    if (taskTitle) {
      return { kind: 'workspace', label: taskTitle };
    }
  }

  if (title && url) {
    return { kind: 'generic', label: title, url };
  }

  if (name && url) {
    return { kind: 'generic', label: name, url };
  }

  return null;
}

function getArtifactFromSteps(steps: AgentStepEvent[] | undefined): ArtifactDescriptor | null {
  if (!steps || steps.length === 0) {
    return null;
  }

  const successfulNotionStep = [...steps].reverse().find((step) =>
    step.type === 'skill_result' &&
    step.skillId === 'notion.create-page' &&
    step.success &&
    getString(step.detail),
  );

  if (successfulNotionStep?.detail) {
    return {
      kind: 'notion',
      label: 'Notion document',
      url: successfulNotionStep.detail,
    };
  }

  return null;
}

function buildArtifactTitle(kind: ArtifactDescriptor['kind']): string {
  switch (kind) {
    case 'notion':
      return 'Notion page created';
    case 'github':
      return 'GitHub issue created';
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

  const artifact = getArtifactFromResult(task.result) ?? getArtifactFromSteps(task.steps);
  if (artifact) {
    return {
      title: buildArtifactTitle(artifact.kind),
      message: buildArtifactMessage(artifact),
      type: 'success',
    };
  }

  const payload = asRecord(task.result);
  const summary = getString(payload?.summary);

  return {
    title: 'Task complete',
    message: summary ?? `${task.intent.slice(0, 100)}${task.intent.length > 100 ? '…' : ''}`,
    type: 'success',
  };
}
