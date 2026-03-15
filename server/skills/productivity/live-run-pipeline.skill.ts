import type { Skill } from '../types';
import { runPipeline } from '../../services/pipelineOrchestrator';
import { buildReplyTarget } from '../../services/channelTasking';

/**
 * Sequential Agent Pipeline
 *
 * Runs a series of agent intents in order, passing each result as context
 * to the next step. Perfect for compound tasks like:
 *   1. Research competitors
 *   2. Write a PRD based on the research
 *   3. Draft an investor email based on the PRD
 */
export const liveRunPipelineSkill: Skill = {
  id: 'live.run-pipeline',
  name: 'Run Agent Pipeline',
  description: [
    'Runs multiple specialist agent tasks in sequence, passing each result to the next step.',
    'Use this for compound tasks that chain research → writing → outreach or similar multi-step workflows.',
    'Each step is an intent string. Steps run in order and share context.',
    'Examples: "Research X, then write a PRD, then draft an investor email."',
  ].join(' '),
  version: '1.0.0',
  category: 'productivity',
  requiresIntegration: [],
  triggerPhrases: [
    'Research then write a report',
    'First research X then create a doc',
    'Run a pipeline of tasks',
  ],
  preferredModel: 'orchestration',
  executionMode: 'inline',
  latencyClass: 'quick',
  sideEffectLevel: 'high',
  exposeInLiveSession: true,
  liveFunctionBehavior: 'NON_BLOCKING' as import('@google/genai').Behavior,
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
  invokingMessage: 'Starting pipeline — running steps in sequence...',
  invokedMessage: 'Pipeline started — tracking each step in the Tasks panel.',
  inputSchema: {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        description: 'Ordered list of task descriptions to run sequentially. Each item is a plain string describing one task. Example: ["Research top 3 competitors", "Write a PRD based on the research", "Draft an investor email"]',
        items: { type: 'string', description: 'A single task description.' },
      },
      intent: {
        type: 'string',
        description: 'Fallback: the full compound task as a single string if steps are not provided separately.',
      },
    },
    required: ['steps'],
  },
  handler: async (ctx, args) => {
    // Accept both string[] and {intent: string}[] for resilience
    const rawSteps = Array.isArray(args.steps) ? args.steps : [];
    const steps = rawSteps
      .map((s) => {
        if (typeof s === 'string') return { intent: s.trim() };
        if (s && typeof s === 'object' && typeof (s as Record<string, unknown>).intent === 'string') {
          return { intent: ((s as Record<string, unknown>).intent as string).trim() };
        }
        return { intent: '' };
      })
      .filter((s) => s.intent.length > 0);

    // Fallback: if Gemini passed a plain intent instead of steps, treat it as one step
    if (steps.length < 1 && typeof args.intent === 'string' && args.intent.trim()) {
      steps.push({ intent: args.intent.trim() });
    }

    if (steps.length < 1) {
      return { success: false, error: 'No valid steps provided to the pipeline.' };
    }

    const originRef = ctx.sessionId
      ? (buildReplyTarget('live_session', { sessionId: ctx.sessionId }) ?? ctx.sessionId)
      : undefined;

    // Fire and forget — each step runs and waits sequentially in the background
    void runPipeline(steps, { ...ctx, originType: 'live_session', originRef }).catch((err) => {
      console.error('[live.run-pipeline] Pipeline error:', err);
    });

    return {
      success: true,
      output: { stepCount: steps.length, steps: steps.map((s) => s.intent) },
      message: `Pipeline of ${steps.length} steps started — tracking in Tasks panel.`,
    };
  },
};
