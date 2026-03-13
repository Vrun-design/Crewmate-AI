import { db } from '../db';
import { createGeminiClient } from './geminiClient';
import {
  deactivateMemoryRecords,
  ingestKnowledgeMemory,
  listSessionRecordsForCompaction,
} from './memoryService';
import { determineComplexity, selectModel } from './modelRouter';
import { logServerError } from './runtimeLogger';

function getText(response: unknown): string {
  if (response && typeof response === 'object' && 'text' in response) {
    return typeof (response as { text?: unknown }).text === 'string' ? (response as { text: string }).text : '';
  }
  return '';
}

export async function runMemorySummarizationPass(): Promise<void> {
  try {
    const userRows = db.prepare(`
      SELECT DISTINCT user_id as userId, workspace_id as workspaceId
      FROM memory_records
      WHERE user_id IS NOT NULL
    `).all() as Array<{ userId: string; workspaceId: string | null }>;

    for (const userRow of userRows) {
      const rows = listSessionRecordsForCompaction(userRow.userId, 12);
      if (rows.length < 8) {
        continue;
      }

      const rowsToCompact = rows.slice(4);
      const rawContext = rowsToCompact
        .map((row) => [row.title, row.summary, row.contentText].filter(Boolean).join('\n'))
        .join('\n\n---\n\n');

      const ai = createGeminiClient();
      const complexity = determineComplexity(rawContext);
      const modelToUse = selectModel('general', complexity, rawContext.length);

      const response = await ai.models.generateContent({
        model: modelToUse,
        contents: `You are consolidating an AI remote employee's working memory.
Extract only durable facts, project context, commitments, decisions, people context, and important references.
Ignore chatter and duplicate details.
Return one concise operational summary.

Context:
${rawContext}`,
      });

      const summary = getText(response).trim();
      if (!summary) {
        continue;
      }

      ingestKnowledgeMemory({
        userId: userRow.userId,
        workspaceId: userRow.workspaceId ?? undefined,
        title: 'Consolidated operating context',
        summary,
        contentText: rawContext.slice(0, 8000),
        sourceType: 'system',
        metadata: {
          compactedFromIds: rowsToCompact.map((row) => row.id),
        },
      });

      deactivateMemoryRecords(userRow.userId, rowsToCompact.map((row) => row.id));
    }
  } catch (err) {
    logServerError('memorySummaryWorker:run-pass', err);
  }
}
