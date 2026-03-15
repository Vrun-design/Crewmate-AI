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
        description: 'Ordered list of task intents to run sequentially. Each step receives the previous step\'s output as context.',
        items: {
          type: 'object',
          description: 'A single pipeline step.',
          properties: {
            intent: { type: 'string', description: 'The task description for this step.' },
          },
          required: ['intent'],
        },
      },
    },
    required: ['steps'],
  },
  handler: async (ctx, args) => {
    const rawSteps = Array.isArray(args.steps) ? args.steps : [];
    const steps = rawSteps
      .map((s) => ({ intent: typeof s?.intent === 'string' ? s.intent.trim() : '' }))
      .filter((s) => s.intent.length > 0);

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
