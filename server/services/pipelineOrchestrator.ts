/**
 * Pipeline Orchestrator
 *
 * Runs a sequence of agent intents one after another, passing the output
 * of each step as context to the next. This is how compound tasks like
 * "research competitors → write a PRD → draft investor email" work.
 *
 * Each step is a plain intent string. The pipeline resolves each step
 * through the normal orchestrator, waits for completion, then prepends
 * a context summary for the next step.
 */

import { orchestrate } from './orchestrator';
import { subscribeToTask } from './orchestratorShared';
import type { SkillRunContext } from '../skills/types';

export interface PipelineStep {
  intent: string;
}

export interface PipelineStepResult {
  step: number;
  intent: string;
  taskId: string;
  status: 'completed' | 'failed';
  summary: string;
  output: unknown;
}

export interface PipelineResult {
  steps: PipelineStepResult[];
  success: boolean;
}

const STEP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per step

function waitForTask(taskId: string): Promise<{ status: 'completed' | 'failed'; result: unknown }> {
  return new Promise((resolve) => {
    let unsubscribe: (() => void) | undefined;
    const timer = setTimeout(() => {
      unsubscribe?.();
      resolve({ status: 'failed', result: { error: 'Step timed out after 5 minutes.' } });
    }, STEP_TIMEOUT_MS);

    unsubscribe = subscribeToTask(taskId, (ssePayload: string) => {
      try {
        const jsonStr = ssePayload.replace(/^data:\s*/, '').trim();
        if (!jsonStr) return;
        const event = JSON.parse(jsonStr) as { type: string; result?: unknown };
        if (event.type === 'completed' || event.type === 'failed') {
          clearTimeout(timer);
          unsubscribe();
          resolve({
            status: event.type as 'completed' | 'failed',
            result: event.result ?? null,
          });
        }
      } catch {
        // Ignore parse errors
      }
    });
  });
}

function extractSummary(result: unknown): string {
  if (!result || typeof result !== 'object') return String(result ?? '');
  const r = result as Record<string, unknown>;
  if (typeof r.message === 'string' && r.message.trim()) return r.message.trim();
  const output = r.output;
  if (!output || typeof output !== 'object') return '';
  const o = output as Record<string, unknown>;
  if (typeof o.text === 'string') return o.text.slice(0, 2000);
  if (typeof o.content === 'string') return o.content.slice(0, 2000);
  if (typeof o.summary === 'string') return o.summary.slice(0, 2000);
  return JSON.stringify(output).slice(0, 2000);
}

export async function runPipeline(
  steps: PipelineStep[],
  ctx: SkillRunContext,
): Promise<PipelineResult> {
  const results: PipelineStepResult[] = [];
  let contextAccumulator = '';

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const enrichedIntent = contextAccumulator
      ? `${step.intent}\n\n[Context from previous steps:\n${contextAccumulator}]`
      : step.intent;

    const { taskId } = await orchestrate(enrichedIntent, {
      ...ctx,
      originType: ctx.originType ?? 'live_session',
    });

    const { status, result } = await waitForTask(taskId);
    const summary = extractSummary(result);

    results.push({ step: i + 1, intent: step.intent, taskId, status, summary, output: result });

    if (status === 'failed') {
      return { steps: results, success: false };
    }

    if (summary) {
      contextAccumulator += `\nStep ${i + 1} — ${step.intent}:\n${summary}\n`;
    }
  }

  return { steps: results, success: true };
}
