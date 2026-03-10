import { randomUUID } from 'node:crypto';
import { db } from '../db';
import { cosineSimilarity, embedText } from './embeddingService';
import type { MemoryNodeRecord } from '../types';

// ── Schema migrations (idempotent) ───────────────────────────────────────────
// Add persona_id, source, created_at, search_text, embedding cols if absent
for (const col of [
  ['persona_id', 'TEXT'],
  ['source', 'TEXT'],
  ['created_at', 'TEXT'],
  ['search_text', 'TEXT'],
  ['embedding', 'TEXT'],
]) {
  try {
    db.exec(`ALTER TABLE memory_nodes ADD COLUMN ${col[0]} ${col[1]}`);
  } catch {
    // Column already exists — ignore
  }
}

export function listMemoryNodes(): MemoryNodeRecord[] {
  return db.prepare(`
    SELECT id, title, type, tokens, last_synced as lastSynced, active
    FROM memory_nodes
    ORDER BY rowid DESC
  `).all().map((row) => ({
    ...row,
    active: Boolean((row as { active: number }).active),
  })) as MemoryNodeRecord[];
}

export function ingestMemoryNode(input: {
  title: string;
  type: MemoryNodeRecord['type'];
  tokens?: string;
  searchText?: string;
  personaId?: string;
  source?: string;
}) {
  const id = `MEM-${randomUUID().slice(0, 8).toUpperCase()}`;
  const now = new Date().toISOString();
  const row = {
    id,
    title: input.title,
    type: input.type,
    tokens: input.tokens ?? '1.0k',
    lastSynced: 'Just now',
    active: 1,
    searchText: input.searchText ?? null,
    embedding: null,
    personaId: input.personaId ?? null,
    source: input.source ?? 'live_turn',
    createdAt: now,
  };

  db.prepare(`
    INSERT INTO memory_nodes (id, title, type, tokens, last_synced, active, search_text, embedding, persona_id, source, created_at)
    VALUES (@id, @title, @type, @tokens, @lastSynced, @active, @searchText, @embedding, @personaId, @source, @createdAt)
  `).run(row);

  // Embed asynchronously — do not block ingestion
  if (input.searchText) {
    void embedAndStore(id, input.searchText);
  }

  return id;
}


async function embedAndStore(nodeId: string, text: string): Promise<void> {
  try {
    const vector = await embedText(text);
    db.prepare(`
      UPDATE memory_nodes SET embedding = ? WHERE id = ?
    `).run(JSON.stringify(vector), nodeId);
  } catch {
    // Non-fatal: memory still saved, just won't be retrievable by similarity yet
  }
}

function estimateTokenCount(text: string): string {
  const roughTokenCount = Math.max(1, Math.ceil(text.trim().length / 4));
  return `${(roughTokenCount / 1000).toFixed(1)}k`;
}

function compactSummary(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

export function ingestLiveTurnMemory(input: { userText: string; assistantText: string }) {
  const combined = `${input.userText}\n${input.assistantText}`.trim();
  const title = compactSummary(`Live turn: ${input.userText}`, 84);

  return ingestMemoryNode({
    title,
    type: 'core',
    tokens: estimateTokenCount(combined),
    searchText: combined,
  });
}

interface ScoredMemory {
  id: string;
  title: string;
  searchText: string;
  similarity: number;
}

/**
 * Retrieve the top-K most semantically relevant memory nodes for a query.
 * Optionally filter by persona. Falls back to most recent nodes if embeddings are unavailable.
 */
export async function retrieveRelevantMemories(queryText: string, topK = 5, personaId?: string): Promise<string[]> {
  type MemoryRow = { id: string; title: string; search_text: string | null; embedding: string | null };

  const whereClause = personaId
    ? 'WHERE active = 1 AND (persona_id = ? OR persona_id IS NULL)'
    : 'WHERE active = 1';
  const params = personaId ? [personaId] : [];

  const rows = db.prepare(`
    SELECT id, title, search_text, embedding
    FROM memory_nodes
    ${whereClause}
    ORDER BY rowid DESC
    LIMIT 200
  `).all(...params) as MemoryRow[];

  if (rows.length === 0) {
    return [];
  }

  // Nodes with embeddings — use cosine similarity
  const embeddedRows = rows.filter((r) => r.embedding);

  if (embeddedRows.length === 0) {
    return rows.slice(0, topK).map((r) => r.title);
  }

  try {
    const queryVector = await embedText(queryText);
    const scored = embeddedRows.map((row) => {
      const vector = JSON.parse(row.embedding!) as number[];
      return {
        id: row.id,
        title: row.title,
        searchText: row.search_text ?? row.title,
        similarity: cosineSimilarity(queryVector, vector),
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, topK).map((m) => m.title);
  } catch {
    return rows.slice(0, topK).map((r) => r.title);
  }
}
