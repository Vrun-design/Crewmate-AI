import { db } from '../db';
import { serverConfig } from '../config';
import { createGeminiClient } from './geminiClient';
import { ingestMemoryNode } from './memoryService';
import { determineComplexity, selectModel } from './modelRouter';

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
            FROM memory_nodes
            WHERE user_id IS NOT NULL
        `).all() as Array<{ userId: string; workspaceId: string | null }>;

        for (const userRow of userRows) {
            const rows = db.prepare(`
                SELECT id, search_text as searchText
                FROM memory_nodes
                WHERE user_id = ? AND type = 'core' AND active = 1
                ORDER BY id ASC
                LIMIT 20
            `).all(userRow.userId) as { id: string, searchText: string | null }[];

            if (rows.length < 5) {
                continue;
            }

            const rawContext = rows
                .map(row => row.searchText)
                .filter(Boolean)
                .join('\n\n---\n\n');

            const ai = createGeminiClient();
            const complexity = determineComplexity(rawContext);
            const modelToUse = selectModel('general', complexity, rawContext.length);

            const response = await ai.models.generateContent({
                model: modelToUse,
                contents: `You are an Always-On Memory Agent.
Analyze these recent live turn transcripts and extract enduring facts, user preferences, or major context points.
Ignore casual chatter. Output a single cohesive summary.

Raw transcripts:
${rawContext}
            `,
            });

            const summary = getText(response).trim();

            if (!summary) {
                continue;
            }

            ingestMemoryNode({
                userId: userRow.userId,
                workspaceId: userRow.workspaceId ?? undefined,
                title: `Summarized context (${rows.length} turns)`,
                type: 'preference',
                tokens: `${Math.max(1, Math.ceil(summary.length / 4 / 1000)).toFixed(1)}k`,
                searchText: summary,
            });

            const idsToDeactivate = rows.map(r => `'${r.id}'`).join(',');
            db.prepare(`UPDATE memory_nodes SET active = 0 WHERE user_id = ? AND id IN (${idsToDeactivate})`).run(userRow.userId);
            console.log(`Memory worker compressed ${rows.length} core nodes into 1 preference node.`);
        }
    } catch (err) {
        console.error('Failed to run memory summarization pass:', err);
    }
}
