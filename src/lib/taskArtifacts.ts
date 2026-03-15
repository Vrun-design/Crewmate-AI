import type { AgentTask, AgentStepEvent } from '../components/agents/types';

export interface TaskArtifactLink {
  kind: 'notion' | 'clickup' | 'workspace' | 'generic';
  label: string;
  url: string;
  imageUrl?: string | null;
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

function buildArtifact(kind: TaskArtifactLink['kind'], label: string, url: string, source: TaskArtifactLink['source'], imageUrl?: string | null): TaskArtifactLink {
  return { kind, label, url, imageUrl, source };
}

export function getArtifactLinkFromResult(result: unknown): TaskArtifactLink | null {
  const output = unwrapResult(result);
  if (!output) {
    return null;
  }

  const screenshot = asRecord(output.screenshot);
  const url = getString(output.url)
    ?? getString(output.publicUrl)
    ?? getString(output.htmlLink)
    ?? getString(output.webViewLink)
    ?? getString(output.documentUrl)
    ?? getString(output.spreadsheetUrl)
    ?? getString(output.presentationUrl)
    ?? getString(output.attachmentUrl)
    ?? getString(screenshot?.publicUrl);
  const title = getString(output.title) ?? getString(output.name) ?? 'Generated artifact';
  const imageUrl = getString(output.publicUrl) ?? getString(screenshot?.publicUrl);

  if (!url) {
    return null;
  }

  if (url.includes('notion.so')) {
    return buildArtifact('notion', title, url, 'result', imageUrl);
  }

  if (url.includes('clickup.com')) {
    return buildArtifact('clickup', title, url, 'result', imageUrl);
  }

  if (url.includes('docs.google.com') || url.includes('calendar.google.com') || url.includes('mail.google.com')) {
    return buildArtifact('workspace', title, url, 'result', imageUrl);
  }

  return buildArtifact('generic', title, url, 'result', imageUrl);
}

export function getArtifactLinkFromSteps(steps: AgentStepEvent[] | undefined): TaskArtifactLink | null {
  if (!steps?.length) {
    return null;
  }

  for (const step of [...steps].reverse()) {
    const url = getString(step.url);
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

export function getTaskArtifactLink(task: Pick<AgentTask, 'result' | 'steps'>): TaskArtifactLink | null {
  return getArtifactLinkFromResult(task.result) ?? getArtifactLinkFromSteps(task.steps);
}
