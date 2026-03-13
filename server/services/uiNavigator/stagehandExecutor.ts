/**
 * Stagehand Executor
 *
 * Replaces the hand-rolled "screenshot → Gemini plan → Playwright action" loop
 * with Stagehand's built-in AI-driven browser navigation.
 *
 * Uses `env: 'LOCAL'` (no Browserbase cloud required) and routes through the
 * same GOOGLE_API_KEY already in the environment.
 *
 * The public API mirrors the old createUiNavigatorExecutor signature exactly,
 * so browserEngine.ts and browser.skills.ts are untouched.
 */
import { Stagehand } from '@browserbasehq/stagehand';
import { serverConfig } from '../../config';
import type { UiExecutionResult, UiNavigatorRunResult } from './uiNavigatorTypes';

interface StagehandExecutorOptions {
  startUrl?: string;
  maxSteps?: number;
}

interface StagehandActResult {
  success: boolean;
  message: string;
  actionDescription: string;
}

const COMPLETION_HINTS = ['done', 'completed', 'finished', 'no action'];

function getStagehandModel(): string {
  const configuredModel = serverConfig.geminiBrowserModel.trim();
  return configuredModel.includes('/') ? configuredModel : `google/${configuredModel}`;
}

function buildSummary(intent: string, steps: UiExecutionResult[], finalUrl: string): string {
  const successCount = steps.filter((s) => s.status === 'completed').length;
  return `Completed "${intent}" in ${successCount} step${successCount !== 1 ? 's' : ''}. Final URL: ${finalUrl}`;
}

function shouldStopAfterAct(result: StagehandActResult): boolean {
  if (!result.success) {
    return true;
  }

  const message = result.message.toLowerCase();
  return COMPLETION_HINTS.some((hint) => message.includes(hint));
}

async function emitStepScreenshot(
  activePage: Awaited<ReturnType<Stagehand['context']['activePage']>>,
  currentUrl: string,
  stepIndex: number,
  onStepScreenshot?: (base64: string, mimeType: string, currentUrl: string, stepIndex: number) => void,
): Promise<void> {
  if (!onStepScreenshot) {
    return;
  }

  try {
    const buffer = await activePage.screenshot({ type: 'jpeg', quality: 75 });
    const base64 = Buffer.isBuffer(buffer) ? buffer.toString('base64') : '';
    onStepScreenshot(base64, 'image/jpeg', currentUrl, stepIndex);
  } catch {
    // Non-fatal — the executor still returns progress even if the PiP frame misses a step.
  }
}

/**
 * Execute a multi-step browser automation task using Stagehand.
 *
 * Stagehand owns the observe-plan-act loop internally. After each act() call
 * we take a viewport screenshot and push it to the caller via the optional
 * callback so the BrowserSessionPiP continues to receive live frames.
 */
export async function executeWithStagehand(
  intent: string,
  options: StagehandExecutorOptions = {},
  onStepScreenshot?: (base64: string, mimeType: string, currentUrl: string, stepIndex: number) => void,
): Promise<UiNavigatorRunResult> {
  const maxSteps = options.maxSteps ?? 20;
  const steps: UiExecutionResult[] = [];

  const stagehand = new Stagehand({
    env: 'LOCAL',
    model: getStagehandModel(),
    verbose: 0,
    disablePino: true,
    localBrowserLaunchOptions: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  try {
    await stagehand.init();

    // Get the active page from the V3 context
    const activePage = stagehand.context.activePage();
    if (!activePage) {
      throw new Error('Stagehand: no active page after init');
    }

    // Navigate to start URL if provided
    if (options.startUrl) {
      await activePage.goto(options.startUrl, { waitUntil: 'domcontentloaded' });
    }

    // Emit initial screenshot
    await emitStepScreenshot(activePage, activePage.url(), 0, onStepScreenshot);

    let stepIndex = 0;
    let lastUrl = activePage.url();

    // Stagehand's act() drives one meaningful action per call.
    // We loop up to maxSteps, asking Stagehand to progress toward the intent.
    while (stepIndex < maxSteps) {
      let actResult: StagehandActResult;

      try {
        const instruction = stepIndex === 0
          ? intent
          : `Continue working toward: ${intent}. Current page: ${activePage.url()}`;

        actResult = await stagehand.act(instruction);
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Stagehand act() failed';
        steps.push({
          action: { type: 'fail', error: detail, reasoning: 'act() threw', safety: 'safe' },
          status: 'failed',
          url: lastUrl,
          detail,
        });

        return {
          status: 'failed',
          steps,
          finalUrl: lastUrl,
          summary: `Browser navigation failed: ${detail}`,
        };
      }

      lastUrl = activePage.url();

      steps.push({
        action: {
          type: 'click',
          selector: actResult.actionDescription ?? 'stagehand-action',
          reasoning: actResult.message,
          safety: 'safe',
        },
        status: actResult.success ? 'completed' : 'failed',
        url: lastUrl,
        detail: actResult.actionDescription || actResult.message,
      });

      await emitStepScreenshot(activePage, lastUrl, stepIndex + 1, onStepScreenshot);

      stepIndex += 1;

      if (shouldStopAfterAct(actResult)) {
        return {
          status: 'completed',
          steps,
          finalUrl: lastUrl,
          summary: buildSummary(intent, steps, lastUrl),
        };
      }
    }

    return {
      status: 'max_steps',
      steps,
      finalUrl: lastUrl,
      summary: `UI navigator reached the ${maxSteps}-step limit.`,
    };
  } finally {
    try {
      await stagehand.close();
    } catch {
      // Best effort cleanup
    }
  }
}

export function createStagehandExecutor(): {
  execute(intent: string, options?: StagehandExecutorOptions): Promise<UiNavigatorRunResult>;
} {
  return {
    execute(intent, options) {
      return executeWithStagehand(intent, options);
    },
  };
}
