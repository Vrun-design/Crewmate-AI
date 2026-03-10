/**
 * Memory Ingestor — Phase 8
 *
 * Multi-source memory ingestion pipeline. Reads from:
 *   - Live session transcripts (already handled by ingestLiveTurnMemory)
 *   - Skill run outputs (tool results worth remembering)
 *   - Agent task results (research briefs, content drafts)
 *   - Manual notes (user-created annotations)
 *
 * Each memory is tagged with persona, source, and timestamp.
 * Embeddings are computed asynchronously for semantic retrieval.
 */
import { db } from '../db';
import { ingestMemoryNode } from './memoryService';
import type { MemoryNodeRecord } from '../types';

export type MemorySource = 'live_turn' | 'skill_run' | 'agent_task' | 'manual' | 'integration';

export interface IngestOptions {
    title: string;
    content: string;
    source: MemorySource;
    personaId?: string;
    tags?: string[];
    type?: MemoryNodeRecord['type'];
}

/**
 * Ingest a memory from any source with persona tagging and source metadata.
 * Returns the new memory node ID.
 */
export function ingestFromSource(opts: IngestOptions): string {
    const tagPrefix = opts.tags?.length ? `[${opts.tags.join(', ')}] ` : '';
    const personaTag = opts.personaId ? `[persona:${opts.personaId}] ` : '';
    const sourceTag = `[source:${opts.source}]`;

    const searchText = `${personaTag}${tagPrefix}${sourceTag}\n\n${opts.content}`;

    return ingestMemoryNode({
        title: opts.title.slice(0, 120),
        type: opts.type ?? 'core',
        tokens: `${Math.max(1, Math.ceil(opts.content.length / 4 / 1000)).toFixed(1)}k`,
        searchText,
        personaId: opts.personaId,
        source: opts.source,
    });
}

/**
 * Ingest a skill run result that's worth remembering.
 * Only meaningful results (not error runs) are persisted.
 */
export function ingestSkillResult(opts: {
    skillId: string;
    skillName: string;
    output: unknown;
    personaId?: string;
}): string | null {
    const text = typeof opts.output === 'string'
        ? opts.output
        : (opts.output as { message?: string })?.message
        ?? JSON.stringify(opts.output, null, 2);

    if (!text || text.length < 20) return null;

    return ingestFromSource({
        title: `${opts.skillName} result`,
        content: text.slice(0, 3000),
        source: 'skill_run',
        personaId: opts.personaId,
        tags: [opts.skillId],
        type: 'core',
    });
}

/**
 * Ingest an agent task result (research briefs, content, etc.)
 */
export function ingestAgentResult(opts: {
    agentId: string;
    intent: string;
    result: unknown;
    personaId?: string;
}): string | null {
    const text = typeof opts.result === 'string'
        ? opts.result
        : JSON.stringify(opts.result, null, 2);

    if (!text || text.length < 20) return null;

    return ingestFromSource({
        title: `Agent: ${opts.intent.slice(0, 80)}`,
        content: text.slice(0, 4000),
        source: 'agent_task',
        personaId: opts.personaId,
        tags: [opts.agentId.replace('crewmate-', '')],
        type: 'preference',
    });
}

/**
 * List memories filtered by persona and/or source.
 */
export function listMemoriesByPersona(personaId: string, limit = 50): MemoryNodeRecord[] {
    return db.prepare(`
    SELECT id, title, type, tokens, last_synced as lastSynced, active
    FROM memory_nodes
    WHERE persona_id = ? AND active = 1
    ORDER BY rowid DESC
    LIMIT ?
  `).all(personaId, limit).map((row) => ({
        ...row,
        active: Boolean((row as { active: number }).active),
    })) as MemoryNodeRecord[];
}

/**
 * List memories timeline (for the new MemoryBase UI).
 */
export function listMemoryTimeline(opts: {
    limit?: number;
    personaId?: string;
    source?: MemorySource;
    searchQuery?: string;
}): Array<MemoryNodeRecord & { personaId?: string; source?: string; createdAt?: string }> {
    const wheres: string[] = ['1=1'];
    const params: unknown[] = [];

    if (opts.personaId) {
        wheres.push('persona_id = ?');
        params.push(opts.personaId);
    }
    if (opts.source) {
        wheres.push('source = ?');
        params.push(opts.source);
    }
    if (opts.searchQuery) {
        wheres.push('(title LIKE ? OR search_text LIKE ?)');
        params.push(`%${opts.searchQuery}%`, `%${opts.searchQuery}%`);
    }

    params.push(opts.limit ?? 50);

    const rows = db.prepare(`
    SELECT id, title, type, tokens, last_synced as lastSynced, active, persona_id, source, created_at
    FROM memory_nodes
    WHERE ${wheres.join(' AND ')}
    ORDER BY rowid DESC
    LIMIT ?
  `).all(...params) as Array<{
        id: string; title: string; type: string; tokens: string;
        lastSynced: string; active: number; persona_id?: string;
        source?: string; created_at?: string;
    }>;

    return rows.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type as MemoryNodeRecord['type'],
        tokens: row.tokens,
        lastSynced: row.lastSynced,
        active: Boolean(row.active),
        personaId: row.persona_id,
        source: row.source,
        createdAt: row.created_at,
    }));
}
