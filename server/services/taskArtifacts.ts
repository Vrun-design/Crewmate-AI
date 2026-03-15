import type { AgentStepEvent } from '../types/agentEvents';

export interface TaskArtifactDescriptor {
  kind: 'notion' | 'clickup' | 'workspace' | 'generic';
  label: string;
  url?: string;
  source: 'result' | 'steps';
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

function buildArtifact(kind: TaskArtifactDescriptor['kind'], label: string, url: string | undefined, source: TaskArtifactDescriptor['source']): TaskArtifactDescriptor {
  return { kind, label, url, source };
}

export function getArtifactFromResult(result: unknown): TaskArtifactDescriptor | null {
  const payload = unwrapResult(result);
  if (!payload) {
    return null;
  }

  const screenshot = asRecord(payload.screenshot);
  const task = asRecord(payload.task);
  const url = getString(payload.url)
    ?? getString(payload.publicUrl)
    ?? getString(payload.htmlLink)
    ?? getString(payload.webViewLink)
    ?? getString(payload.documentUrl)
    ?? getString(payload.spreadsheetUrl)
    ?? getString(payload.presentationUrl)
    ?? getString(payload.attachmentUrl)
    ?? getString(screenshot?.publicUrl);
  const title = getString(payload.title) ?? getString(payload.name) ?? getString(payload.summary);

  if (title && url?.includes('notion.so')) {
    return buildArtifact('notion', title, url, 'result');
  }

  if (title && url?.includes('clickup.com')) {
    return buildArtifact('clickup', title, url, 'result');
  }

  if (title && (url?.includes('docs.google.com') || url?.includes('calendar.google.com') || url?.includes('mail.google.com'))) {
    return buildArtifact('workspace', title, url, 'result');
  }

  if (task) {
    const taskTitle = getString(task.title);
    if (taskTitle) {
      return buildArtifact('workspace', taskTitle, undefined, 'result');
    }
  }

  if (url) {
    return buildArtifact('generic', title ?? 'Generated artifact', url, 'result');
  }

  return null;
}

export function getArtifactFromSteps(steps: AgentStepEvent[] | undefined): TaskArtifactDescriptor | null {
  if (!steps?.length) {
    return null;
  }

  for (const step of [...steps].reverse()) {
    const url = getString(step.url) ?? null;
    if (!url || step.success === false) {
      continue;
    }

    if (step.skillId === 'notion.create-page') {
      return buildArtifact('notion', 'Notion document', url, 'steps');
    }

    if (step.skillId === 'clickup.create-task') {
      return buildArtifact('clickup', 'ClickUp task', url, 'steps');
    }

    if (step.skillId?.startsWith('google.')) {
      return buildArtifact('workspace', 'Google Workspace file', url, 'steps');
    }

    return buildArtifact('generic', step.label, url, 'steps');
  }

  const successfulNotionStep = [...steps].reverse().find((step) =>
    step.type === 'skill_result'
    && step.skillId === 'notion.create-page'
    && step.success
    && getString(step.detail),
  );

  if (successfulNotionStep?.detail) {
    return buildArtifact('notion', 'Notion document', successfulNotionStep.detail, 'steps');
  }

  return null;
}

export function getTaskArtifact(result: unknown, steps?: AgentStepEvent[]): TaskArtifactDescriptor | null {
  return getArtifactFromResult(result) ?? getArtifactFromSteps(steps);
}
