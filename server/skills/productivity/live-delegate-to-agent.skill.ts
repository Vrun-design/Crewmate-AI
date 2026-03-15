import type { Skill } from '../types';
import { orchestrate } from '../../services/orchestrator';
import { buildReplyTarget } from '../../services/channelTasking';

/**
 * The Live → Agent Bridge
 *
 * This is the single most important skill in the live session. It connects
 * Gemini Live to the full 14-agent orchestration layer.
 *
 * When Gemini calls this skill with a user intent, it:
 *  1. Calls orchestrate(intent) — the same entry point used by async tasks
 *  2. routeIntent() runs: Gemini picks the right specialist agent
 *  3. The agent runs in the background with full multi-step reasoning
 *  4. SSE streams steps to the Tasks panel in real-time
 *
 * Without this skill, live sessions can only call thin skills (single API calls).
 * With this skill, every voice command can reach Research, Content, Data, Sales,
 * HR, Legal, DevOps, Marketing, Product, Support, Social, Finance, or UI Navigator.
 */
export const liveDelegateToAgentSkill: Skill = {
  id: 'live.delegate-to-agent',
  name: 'Delegate to Agent',
  description: [
    'Routes a complex or multi-step task to the best specialist agent.',
    'Use this for: research, writing, analysis, content creation, sales outreach,',
    'marketing briefs, HR docs, legal review, financial reports, data analysis,',
    'social posts, support responses, product specs, DevOps tasks, or any compound',
    'task that requires judgment, multiple steps, or professional-quality output.',
    'Do NOT use for simple atomic tasks like listing emails, creating a folder, or',
    'posting a message — call those skills directly instead.',
  ].join(' '),
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: [],
  triggerPhrases: [
    'Research and build me a deck',
    'Write a blog post about',
    'Draft an outreach email to',
    'Analyse my competitors',
    'Create a PRD for',
    'Build a financial report for',
  ],
  preferredModel: 'orchestration',
  // Run inline so the tool runner calls the handler directly.
  // The handler fires orchestrate() which immediately returns a taskId (background work),
  // so this returns in ~100ms and avoids creating a pointless wrapper task.
  executionMode: 'inline',
  latencyClass: 'quick',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  liveFunctionBehavior: 'NON_BLOCKING' as import('@google/genai').Behavior,
  usageExamples: [
    'Research the top 5 CRM tools and compare them',
    'Write a competitive analysis for our product',
    'Draft a sales email to Stripe about partnership',
    'Build a Q1 marketing brief and save it to Notion',
  ],
  invokingMessage: 'Routing to the best specialist agent...',
  invokedMessage: 'Task delegated to agent — tracking in Tasks panel.',
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
  inputSchema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description: 'The full task description exactly as the user expressed it. Be complete — the agent uses this as its sole input.',
      },
    },
    required: ['intent'],
  },
  handler: async (ctx, args) => {
    const intent = typeof args.intent === 'string' ? args.intent.trim() : '';
    if (!intent) {
      return { success: false, error: 'No intent provided to delegate.' };
    }

    const originRef = ctx.sessionId
      ? (buildReplyTarget('live_session', { sessionId: ctx.sessionId }) ?? ctx.sessionId)
      : undefined;

    const { taskId, routeType } = await orchestrate(intent, {
      ...ctx,
      originType: 'live_session',
      originRef,
    });

    return {
      success: true,
      output: { taskId, routeType },
      message: `Task delegated (${routeType}) — tracking in Tasks panel.`,
    };
  },
};
