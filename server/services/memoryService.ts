import {randomUUID} from 'node:crypto';
import {db} from '../db';
import type {MemoryNodeRecord} from '../types';

export function listMemoryNodes(): MemoryNodeRecord[] {
  return db.prepare(`
    SELECT id, title, type, tokens, last_synced as lastSynced, active
    FROM memory_nodes
    ORDER BY id ASC
  `).all().map((row) => ({
    ...row,
    active: Boolean((row as {active: number}).active),
  })) as MemoryNodeRecord[];
}

export function ingestMemoryNode(input: {title: string; type: MemoryNodeRecord['type']; tokens?: string}) {
  const id = `MEM-${randomUUID().slice(0, 8).toUpperCase()}`;
  const row = {
    id,
    title: input.title,
    type: input.type,
    tokens: input.tokens ?? '1.0k',
    lastSynced: 'Just now',
    active: 1,
  };

  db.prepare(`
    INSERT INTO memory_nodes (id, title, type, tokens, last_synced, active)
    VALUES (@id, @title, @type, @tokens, @lastSynced, @active)
  `).run(row);

  return id;
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

export function ingestLiveTurnMemory(input: {userText: string; assistantText: string}) {
  const title = compactSummary(`Live turn: ${input.userText}`, 84);
  const combined = `${input.userText}\n${input.assistantText}`.trim();

  return ingestMemoryNode({
    title,
    type: 'core',
    tokens: estimateTokenCount(combined),
  });
}
