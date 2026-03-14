/**
 * liveSessionSummaryService.ts
 *
 * After a live session ends, generates a brief Gemini summary of the transcript
 * and stores it in memory_records (kind='session'). Future sessions can then
 * reference what happened in previous sessions via the prompt builder.
 */
import { db } from '../db';
import { listTranscript } from '../repositories/sessionRepository';
import { ingestMemoryRecord } from './memoryService';
import { createGeminiClient } from './geminiClient';
import { serverConfig } from '../config';

export async function generateAndSaveSessionSummary(sessionId: string, userId: string): Promise<void> {
  const transcript = listTranscript(sessionId);
  // Require at least 3 messages to be worth summarizing
  if (transcript.length < 3) return;

  const memberRow = db
    .prepare('SELECT workspace_id as workspaceId FROM workspace_members WHERE user_id = ? LIMIT 1')
    .get(userId) as { workspaceId: string } | undefined;
  const workspaceId = memberRow?.workspaceId;

  const transcriptText = transcript
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n')
    .slice(0, 10000);

  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: serverConfig.geminiTextModel,
      contents: [
        'Summarize this live session transcript in 2-3 sentences.',
        'Focus on: what the user worked on, key decisions or outputs, and any important next steps.',
        'Be specific and concrete. Do not use generic language.',
        '',
        'Transcript:',
        transcriptText,
      ].join('\n'),
    });

    const summary = response.text?.trim();
    if (!summary || summary.length < 20) return;

    const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    ingestMemoryRecord({
      userId,
      workspaceId,
      kind: 'session',
      sourceType: 'live_turn',
      title: `Session summary — ${date}`,
      summary,
      contentText: summary,
      metadata: { sessionId },
    });
  } catch {
    // Non-fatal — if Gemini is unavailable the session still ends cleanly
  }
}
