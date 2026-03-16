import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { cosineSimilarity, embedText, getEmbeddingModel } from './embeddingService';

export type MemoryKind = 'session' | 'knowledge' | 'artifact';
export type MemorySourceType = 'live_turn' | 'skill_run' | 'agent_task' | 'manual' | 'integration' | 'meeting' | 'system';

export interface MemoryRecord {
  id: string;
  userId: string;
  workspaceId?: string | null;
  kind: MemoryKind;
  sourceType: MemorySourceType;
  title: string;
  summary?: string | null;
  contentText?: string | null;
  artifactUrl?: string | null;
  metadata?: Record<string, unknown>;
  tokens: string;
  active: boolean;
  embeddingModel?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryOverview {
  recentContext: MemoryRecord[];
  knowledge: MemoryRecord[];
  artifacts: MemoryRecord[];
  totals: {
    recentContext: number;
    knowledge: number;
    artifacts: number;
    active: number;
  };
}

interface MemoryRow {
  id: string;
  user_id: string;
  workspace_id?: string | null;
  kind: string;
  source_type: string;
  title: string;
  summary?: string | null;
  content_text?: string | null;
  artifact_url?: string | null;
  metadata_json: string;
  tokens: string;
  active: number;
  embedding?: string | null;
  embedding_model?: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function estimateTokenCount(text: string): string {
  const roughTokenCount = Math.max(1, Math.ceil(normalizeText(text).length / 4));
  return `${(roughTokenCount / 1000).toFixed(1)}k`;
}

function compactSummary(text: string, maxLength: number): string {
  const normalized = normalizeText(text);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function getMemoryLabel(row: Pick<MemoryRow, 'kind' | 'title' | 'summary' | 'content_text' | 'artifact_url'>): string {
  const body = row.summary || row.content_text || '';
  if (row.kind === 'artifact' && row.artifact_url) {
    return body ? `${row.title}: ${row.artifact_url}\n${body}` : `${row.title}: ${row.artifact_url}`;
  }
  return body ? `${row.title}\n${body}` : row.title;
}

function rowToMemoryRecord(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id ?? null,
    kind: row.kind as MemoryKind,
    sourceType: row.source_type as MemorySourceType,
    title: row.title,
    summary: row.summary ?? null,
    contentText: row.content_text ?? null,
    artifactUrl: row.artifact_url ?? null,
    metadata: JSON.parse(row.metadata_json || '{}') as Record<string, unknown>,
    tokens: row.tokens,
    active: Boolean(row.active),
    embeddingModel: row.embedding_model ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recordSearchText(input: {
  title: string;
  summary?: string;
  contentText?: string;
  artifactUrl?: string;
  metadata?: Record<string, unknown>;
}): string {
  const metadataText = input.metadata
    ? Object.entries(input.metadata)
        .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join('\n')
    : '';

  return normalizeText([
    input.title,
    input.summary ?? '',
    input.contentText ?? '',
    input.artifactUrl ?? '',
    metadataText,
  ].filter(Boolean).join('\n'));
}

export function ingestMemoryRecord(input: {
  userId: string;
  workspaceId?: string;
  kind: MemoryKind;
  sourceType: MemorySourceType;
  title: string;
  summary?: string;
  contentText?: string;
  artifactUrl?: string;
  metadata?: Record<string, unknown>;
  tokens?: string;
  active?: boolean;
}): string {
  const id = `MEM-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  const searchText = recordSearchText(input);
  const row = {
    id,
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    kind: input.kind,
    sourceType: input.sourceType,
    title: compactSummary(input.title, 160),
    summary: input.summary ?? null,
    contentText: input.contentText ?? null,
    artifactUrl: input.artifactUrl ?? null,
    metadataJson: JSON.stringify(input.metadata ?? {}),
    tokens: input.tokens ?? estimateTokenCount(searchText),
    active: input.active === false ? 0 : 1,
    embedding: null,
    embeddingModel: null,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO memory_records (
      id, user_id, workspace_id, kind, source_type, title, summary, content_text,
      artifact_url, metadata_json, tokens, active, embedding, embedding_model, created_at, updated_at
    )
    VALUES (
      @id, @userId, @workspaceId, @kind, @sourceType, @title, @summary, @contentText,
      @artifactUrl, @metadataJson, @tokens, @active, @embedding, @embeddingModel, @createdAt, @updatedAt
    )
  `).run(row);

  if (searchText) {
    void embedAndStore(id, searchText);
  }

  return id;
}

async function embedAndStore(recordId: string, text: string): Promise<void> {
  try {
    const vector = await embedText(text);
    db.prepare(`
      UPDATE memory_records
      SET embedding = ?, embedding_model = ?, updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(vector), getEmbeddingModel(), new Date().toISOString(), recordId);
  } catch {
    // Non-fatal. Retrieval falls back to lexical ordering.
  }
}

export function ingestLiveTurnMemory(input: {
  userId: string;
  workspaceId?: string;
  sessionId?: string;
  userText: string;
  assistantText: string;
}): string {
  const combined = normalizeText(`${input.userText}\n${input.assistantText}`);
  const summary = compactSummary(`${input.userText} -> ${input.assistantText}`, 220);

  return ingestMemoryRecord({
    userId: input.userId,
    workspaceId: input.workspaceId,
    kind: 'session',
    sourceType: 'live_turn',
    title: compactSummary(`Live session: ${input.userText}`, 120),
    summary,
    contentText: combined,
    metadata: {
      sessionId: input.sessionId ?? null,
      speaker: 'user+assistant',
    },
  });
}

export function ingestArtifactMemory(input: {
  userId: string;
  workspaceId?: string;
  title: string;
  url?: string;
  sourceType?: MemorySourceType;
  summary?: string;
  metadata?: Record<string, unknown>;
}): string {
  return ingestMemoryRecord({
    userId: input.userId,
    workspaceId: input.workspaceId,
    kind: 'artifact',
    sourceType: input.sourceType ?? 'integration',
    title: input.title,
    summary: input.summary,
    artifactUrl: input.url,
    metadata: input.metadata,
  });
}

export function ingestKnowledgeMemory(input: {
  userId: string;
  workspaceId?: string;
  title: string;
  summary: string;
  contentText?: string;
  sourceType?: MemorySourceType;
  metadata?: Record<string, unknown>;
}): string {
  return ingestMemoryRecord({
    userId: input.userId,
    workspaceId: input.workspaceId,
    kind: 'knowledge',
    sourceType: input.sourceType ?? 'system',
    title: input.title,
    summary: input.summary,
    contentText: input.contentText,
    metadata: input.metadata,
  });
}

export function listMemoryOverview(
  userId: string,
  opts: { query?: string; source?: MemorySourceType; limitPerKind?: number } = {},
): MemoryOverview {
  const rows = searchMemoryRecords(userId, {
    query: opts.query,
    source: opts.source,
    includeInactive: false,
    limit: (opts.limitPerKind ?? 20) * 6,
  });

  const recentContext = rows.filter((row) => row.kind === 'session').slice(0, opts.limitPerKind ?? 20);
  const knowledge = rows.filter((row) => row.kind === 'knowledge').slice(0, opts.limitPerKind ?? 20);
  const artifacts = rows.filter((row) => row.kind === 'artifact').slice(0, opts.limitPerKind ?? 20);

  const totalRow = db.prepare(`
    SELECT
      SUM(CASE WHEN kind = 'session' AND active = 1 THEN 1 ELSE 0 END) AS recent_context,
      SUM(CASE WHEN kind = 'knowledge' AND active = 1 THEN 1 ELSE 0 END) AS knowledge,
      SUM(CASE WHEN kind = 'artifact' AND active = 1 THEN 1 ELSE 0 END) AS artifacts,
      SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS active_total
    FROM memory_records
    WHERE user_id = ?
  `).get(userId) as {
    recent_context?: number;
    knowledge?: number;
    artifacts?: number;
    active_total?: number;
  };

  return {
    recentContext,
    knowledge,
    artifacts,
    totals: {
      recentContext: totalRow.recent_context ?? 0,
      knowledge: totalRow.knowledge ?? 0,
      artifacts: totalRow.artifacts ?? 0,
      active: totalRow.active_total ?? 0,
    },
  };
}

export function searchMemoryRecords(
  userId: string,
  opts: {
    query?: string;
    source?: MemorySourceType;
    kinds?: MemoryKind[];
    includeInactive?: boolean;
    limit?: number;
  } = {},
): MemoryRecord[] {
  const wheres = ['user_id = ?'];
  const params: unknown[] = [userId];

  if (!opts.includeInactive) {
    wheres.push('active = 1');
  }
  if (opts.source) {
    wheres.push('source_type = ?');
    params.push(opts.source);
  }
  if (opts.kinds?.length) {
    wheres.push(`kind IN (${opts.kinds.map(() => '?').join(', ')})`);
    params.push(...opts.kinds);
  }
  if (opts.query) {
    wheres.push('(title LIKE ? OR summary LIKE ? OR content_text LIKE ? OR artifact_url LIKE ?)');
    params.push(`%${opts.query}%`, `%${opts.query}%`, `%${opts.query}%`, `%${opts.query}%`);
  }

  params.push(opts.limit ?? 100);

  const rows = db.prepare(`
    SELECT *
    FROM memory_records
    WHERE ${wheres.join(' AND ')}
    ORDER BY datetime(updated_at) DESC
    LIMIT ?
  `).all(...params) as MemoryRow[];

  return rows.map(rowToMemoryRecord);
}

export async function retrieveRelevantMemories(
  userId: string,
  queryText: string,
  topK = 5,
): Promise<string[]> {
  type SearchRow = MemoryRow;

  const rows = db.prepare(`
    SELECT *
    FROM memory_records
    WHERE user_id = ? AND active = 1
    ORDER BY datetime(updated_at) DESC
    LIMIT 200
  `).all(userId) as SearchRow[];

  if (rows.length === 0) {
    return [];
  }

  const embeddedRows = rows.filter((row) => row.embedding);

  if (embeddedRows.length === 0) {
    return rows.slice(0, topK).map(getMemoryLabel);
  }

  try {
    const queryVector = await embedText(queryText);
    const scored = embeddedRows.map((row) => ({
      label: getMemoryLabel(row),
      similarity: cosineSimilarity(queryVector, JSON.parse(row.embedding!) as number[]),
    }));

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK).map((row) => row.label);
  } catch {
    return rows.slice(0, topK).map(getMemoryLabel);
  }
}

export function setMemoryRecordActive(userId: string, id: string, active: boolean): void {
  db.prepare(`
    UPDATE memory_records
    SET active = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(active ? 1 : 0, new Date().toISOString(), id, userId);
}

export function deleteMemoryRecord(userId: string, id: string): void {
  db.prepare(`
    DELETE FROM memory_records
    WHERE id = ? AND user_id = ?
  `).run(id, userId);
}

export function listSessionRecordsForCompaction(userId: string, limit = 12): MemoryRecord[] {
  return searchMemoryRecords(userId, {
    kinds: ['session'],
    includeInactive: false,
    limit,
  });
}

export function deactivateMemoryRecords(userId: string, ids: string[]): void {
  if (ids.length === 0) {
    return;
  }

  db.prepare(`
    UPDATE memory_records
    SET active = 0, updated_at = ?
    WHERE user_id = ? AND id IN (${ids.map(() => '?').join(', ')})
  `).run(new Date().toISOString(), userId, ...ids);
}
