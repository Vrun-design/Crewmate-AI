import {
  ingestArtifactMemory,
  ingestKnowledgeMemory,
  ingestMemoryRecord,
  searchMemoryRecords,
  type MemoryKind,
  type MemorySourceType,
} from './memoryService';

export type MemorySource = MemorySourceType;

export interface IngestOptions {
  userId: string;
  workspaceId?: string;
  title: string;
  content: string;
  source: MemorySource;
  tags?: string[];
  type?: 'document' | 'preference' | 'integration' | 'core';
}

export function ingestFromSource(opts: IngestOptions): string {
  const metadata = opts.tags?.length ? { tags: opts.tags } : undefined;
  const kind: MemoryKind = opts.type === 'integration' ? 'artifact' : 'knowledge';

  return ingestMemoryRecord({
    userId: opts.userId,
    workspaceId: opts.workspaceId,
    kind,
    sourceType: opts.source,
    title: opts.title,
    summary: opts.content.slice(0, 280),
    contentText: opts.content,
    metadata,
  });
}

export function ingestSkillResult(opts: {
  userId: string;
  workspaceId?: string;
  skillId: string;
  skillName: string;
  output: unknown;
  taskId?: string;
  taskRunId?: string;
  sessionId?: string;
  originType?: string;
  originRef?: string;
}): string | null {
  const text = typeof opts.output === 'string'
    ? opts.output
    : (opts.output as { message?: string })?.message ?? JSON.stringify(opts.output, null, 2);

  if (!text || text.length < 20) {
    return null;
  }

  const metadata = {
    skillId: opts.skillId,
    taskId: opts.taskId ?? null,
    taskRunId: opts.taskRunId ?? null,
    sessionId: opts.sessionId ?? null,
    originType: opts.originType ?? null,
    originRef: opts.originRef ?? null,
  };

  maybeIngestArtifactFromOutput({
    userId: opts.userId,
    workspaceId: opts.workspaceId,
    output: opts.output,
    metadata,
  });

  return ingestKnowledgeMemory({
    userId: opts.userId,
    workspaceId: opts.workspaceId,
    title: `${opts.skillName} result`,
    summary: text.slice(0, 280),
    contentText: text.slice(0, 3000),
    sourceType: 'skill_run',
    metadata,
  });
}

export function ingestAgentResult(opts: {
  userId: string;
  workspaceId?: string;
  agentId: string;
  intent: string;
  result: unknown;
  taskId?: string;
  sessionId?: string;
  originType?: string;
  originRef?: string;
}): string | null {
  const text = typeof opts.result === 'string'
    ? opts.result
    : JSON.stringify(opts.result, null, 2);

  if (!text || text.length < 20) {
    return null;
  }

  const metadata = {
    agentId: opts.agentId,
    taskId: opts.taskId ?? null,
    sessionId: opts.sessionId ?? null,
    originType: opts.originType ?? null,
    originRef: opts.originRef ?? null,
  };

  maybeIngestArtifactFromOutput({
    userId: opts.userId,
    workspaceId: opts.workspaceId,
    output: opts.result,
    metadata,
  });

  return ingestKnowledgeMemory({
    userId: opts.userId,
    workspaceId: opts.workspaceId,
    title: `Agent result: ${opts.intent.slice(0, 80)}`,
    summary: text.slice(0, 280),
    contentText: text.slice(0, 4000),
    sourceType: 'agent_task',
    metadata,
  });
}

export function ingestArtifactLink(opts: {
  userId: string;
  workspaceId?: string;
  title: string;
  url: string;
  provider: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}): string {
  return ingestArtifactMemory({
    userId: opts.userId,
    workspaceId: opts.workspaceId,
    title: opts.title,
    url: opts.url,
    sourceType: 'integration',
    summary: opts.summary,
    metadata: { provider: opts.provider, ...(opts.metadata ?? {}) },
  });
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

function maybeIngestArtifactFromOutput(opts: {
  userId: string;
  workspaceId?: string;
  output: unknown;
  metadata: Record<string, unknown>;
}): string | null {
  const payload = asRecord(opts.output);
  const nested = asRecord(payload?.output);
  const target = nested ?? payload;
  if (!target) {
    return null;
  }

  const notionTitle = getString(target.title);
  const notionUrl = getString(target.url);
  if (notionTitle && notionUrl?.includes('notion.so')) {
    return ingestArtifactMemory({
      userId: opts.userId,
      workspaceId: opts.workspaceId,
      title: notionTitle,
      url: notionUrl,
      summary: `Notion artifact created by Crewmate`,
      metadata: { provider: 'Notion', ...opts.metadata },
    });
  }

  const clickupName = getString(target.name);
  const clickupUrl = getString(target.url);
  if (clickupName && clickupUrl?.includes('clickup.com')) {
    return ingestArtifactMemory({
      userId: opts.userId,
      workspaceId: opts.workspaceId,
      title: clickupName,
      url: clickupUrl,
      summary: `ClickUp task created by Crewmate`,
      metadata: { provider: 'ClickUp', ...opts.metadata },
    });
  }

  const workspaceTask = asRecord(target.task);
  const taskTitle = getString(workspaceTask?.title);
  if (taskTitle) {
    return ingestArtifactMemory({
      userId: opts.userId,
      workspaceId: opts.workspaceId,
      title: taskTitle,
      summary: 'Workspace task created by Crewmate',
      metadata: { provider: 'Crewmate', ...opts.metadata },
    });
  }

  const screenshotPublicUrl = getString(target.publicUrl);
  const screenshotTitle = getString(target.title) ?? getString(target.caption) ?? 'Captured screenshot';
  if (screenshotPublicUrl?.includes('/api/artifacts/screenshots/')) {
    return ingestArtifactMemory({
      userId: opts.userId,
      workspaceId: opts.workspaceId,
      title: screenshotTitle,
      url: screenshotPublicUrl,
      summary: 'Screenshot artifact captured by Crewmate',
      metadata: { provider: 'Screenshot', ...opts.metadata },
    });
  }

  const screenshotRecord = asRecord(target.screenshot);
  const screenshotRecordUrl = getString(screenshotRecord?.publicUrl);
  if (screenshotRecordUrl) {
    return ingestArtifactMemory({
      userId: opts.userId,
      workspaceId: opts.workspaceId,
      title: getString(screenshotRecord?.title) ?? 'Captured screenshot',
      url: screenshotRecordUrl,
      summary: 'Screenshot artifact used by Crewmate',
      metadata: { provider: 'Screenshot', ...opts.metadata },
    });
  }

  return null;
}
