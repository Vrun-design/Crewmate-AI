import type { Skill } from '../types';
import { createGeminiClient } from '../../services/geminiClient';
import { serverConfig } from '../../config';
import { listCalendarEvents } from '../../services/calendarService';
import { searchGmailMessages, readGmailMessage } from '../../services/gmailService';
import { listActiveTasks } from '../../services/orchestratorShared';
import { retrieveRelevantMemories } from '../../services/memoryService';

export const morningBriefingSkill: Skill = {
  id: 'productivity.morning-briefing',
  name: 'Morning Briefing',
  description:
    'Generate a concise morning briefing that combines your calendar for today, recent emails, active background tasks, and relevant memory. Perfect for starting the day with full context.',
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: [],
  triggerPhrases: [
    "What's my morning briefing",
    'Brief me for today',
    'What do I have today',
    'Morning update',
  ],
  preferredModel: 'quick',
  executionMode: 'delegated',
  latencyClass: 'slow',
  sideEffectLevel: 'none',
  exposeInLiveSession: true,
  inputSchema: { type: 'object', properties: {} },
  handler: async (ctx, _args) => {
    // ── 1. Gather data (partial failures are fine) ──────────────────────────

    let calendarSection = 'Calendar: unavailable';
    try {
      const events = await listCalendarEvents(ctx.workspaceId, { maxResults: 8 });
      if (events.length === 0) {
        calendarSection = 'Calendar: no events scheduled for today.';
      } else {
        const lines = events.map((e) => {
          const startVal = e.start?.dateTime ?? e.start?.date ?? null;
          const time = startVal ? new Date(startVal).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'all-day';
          return `- ${time}: ${e.summary ?? '(untitled)'}`;
        });
        calendarSection = `Calendar (today):\n${lines.join('\n')}`;
      }
    } catch {
      // silently skip
    }

    let gmailSection = 'Gmail: unavailable';
    try {
      const messages = await searchGmailMessages(ctx.workspaceId, 'newer_than:1d');
      const ids = messages.slice(0, 5).map((m) => m.id);
      if (ids.length === 0) {
        gmailSection = 'Gmail: no new messages in the last 24 hours.';
      } else {
        const emailLines: string[] = [];
        for (const id of ids) {
          try {
            const msg = await readGmailMessage(ctx.workspaceId, id);
            emailLines.push(`- From: ${msg.from} | Subject: ${msg.subject}`);
          } catch {
            // skip unreadable message
          }
        }
        gmailSection = `Recent Gmail (last 24h):\n${emailLines.join('\n')}`;
      }
    } catch {
      // silently skip
    }

    let tasksSection = 'Active tasks: none.';
    try {
      const tasks = listActiveTasks(ctx.userId, 5);
      if (tasks.length > 0) {
        const lines = tasks.map((t) => `- [${t.status}] ${t.intent ?? t.agentId}`);
        tasksSection = `Active background tasks:\n${lines.join('\n')}`;
      }
    } catch {
      // silently skip
    }

    let memorySection = '';
    try {
      const memories = await retrieveRelevantMemories(ctx.userId, 'recent work ongoing projects', 3);
      if (memories.length > 0) {
        const lines = memories.map((m) => `- ${m}`);
        memorySection = `Relevant context from memory:\n${lines.join('\n')}`;
      }
    } catch {
      // silently skip
    }

    // ── 2. Build prompt ─────────────────────────────────────────────────────

    const dataParts = [calendarSection, gmailSection, tasksSection, memorySection]
      .filter(Boolean)
      .join('\n\n');

    const prompt = `You are a personal AI assistant. Generate a crisp morning briefing for the user in exactly 2-3 short paragraphs.

Paragraph 1: What's on the calendar today — highlight any important meetings or time-sensitive events.
Paragraph 2: What's in the inbox — summarize notable emails they should be aware of.
Paragraph 3: What agents are working on in the background, and any relevant ongoing context from memory (skip if nothing notable).

Keep the tone warm but efficient. Do not repeat raw data verbatim — synthesize it into clear insight. If data is unavailable for a section, briefly acknowledge it and move on.

--- DATA ---
${dataParts}
--- END DATA ---

Write the briefing now:`;

    // ── 3. Call Gemini ───────────────────────────────────────────────────────

    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: serverConfig.geminiTextModel,
      contents: prompt,
    });

    const briefing = response.text ?? 'Unable to generate briefing at this time.';

    return {
      success: true,
      output: { briefing },
      message: briefing,
    };
  },
};
