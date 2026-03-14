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
import { createGeminiClient } from '../geminiClient';
import {
  extractApexDomain,
  loadUserCookies,
  saveUserCookies,
  type StoredCookie,
} from './browserSessionManager';
import type { UiExecutionResult, UiNavigatorRunResult } from './uiNavigatorTypes';

interface StagehandExecutorOptions {
  startUrl?: string;
  maxSteps?: number;
  userId?: string; // Used to load/save per-user cookies
}

interface StagehandActResult {
  success: boolean;
  message: string;
  actionDescription: string;
}

const COMPLETION_HINTS = ['done', 'completed', 'finished', 'no action'];
const BLOCKED_HINTS = [
  'captcha',
  'verification code',
  'verification required',
  'two-factor',
  'two factor',
  '2fa',
  'sign in',
  'log in',
  'login required',
  'authentication required',
  'requires authentication',
  'human verification',
  'permission denied',
  'access denied',
];
const RETRYABLE_FAILURE_HINTS = [
  'timeout',
  'timed out',
  'still loading',
  'loading',
  'detached',
  'intercepted',
  'not clickable',
  'not visible',
  'covered',
  'overlay',
  'temporarily unavailable',
  'navigation',
  'network',
];

function getStagehandModel(): string {
  const configuredModel = serverConfig.geminiBrowserModel.trim();
  return configuredModel.includes('/') ? configuredModel : `google/${configuredModel}`;
}

function buildSummary(intent: string, steps: UiExecutionResult[], finalUrl: string): string {
  const successCount = steps.filter((s) => s.status === 'completed').length;
  return `Completed "${intent}" in ${successCount} step${successCount !== 1 ? 's' : ''}. Final URL: ${finalUrl}`;
}

/**
 * Use Gemini Vision to verify whether the task appears to have succeeded
 * based on the final page screenshot. Returns a short verification note.
 */
async function verifyTaskCompletion(
  intent: string,
  screenshotBase64: string,
): Promise<string | null> {
  if (!screenshotBase64) return null;

  try {
    const ai = createGeminiClient();
    const response = await ai.models.generateContent({
      model: serverConfig.geminiBrowserModel.trim().includes('/')
        ? serverConfig.geminiBrowserModel.trim()
        : `google/${serverConfig.geminiBrowserModel.trim()}`,
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: screenshotBase64,
              },
            },
            {
              text: `You are verifying whether a browser automation task completed successfully.

Task: "${intent}"

Look at this screenshot of the final page state and answer in ONE sentence:
- If you see a success message, confirmation, or clear evidence the task worked: "Task completed successfully — [what you see]"
- If you see an error, still on the original page, or the task clearly failed: "Task may have failed — [what you see]"
- If it's unclear: "Result is unclear — [what you see]"

Be specific and brief.`,
            },
          ],
        },
      ],
    });
    return response.text?.trim() ?? null;
  } catch {
    return null; // Non-fatal — don't break task reporting if vision fails
  }
}

function describeActResult(result: StagehandActResult): string {
  return [result.message, result.actionDescription].filter(Boolean).join(' | ').trim();
}

function isCompletionMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return COMPLETION_HINTS.some((hint) => normalizedMessage.includes(hint));
}

function containsHint(text: string, hints: string[]): boolean {
  const normalizedText = text.toLowerCase();
  return hints.some((hint) => normalizedText.includes(hint));
}

function isBlockedMessage(detail: string): boolean {
  return containsHint(detail, BLOCKED_HINTS);
}

function isRetryableFailure(detail: string): boolean {
  return containsHint(detail, RETRYABLE_FAILURE_HINTS);
}

function getFailureSummary(result: StagehandActResult): string {
  const detail = result.message.trim() || result.actionDescription.trim() || 'Stagehand returned an unsuccessful action.';
  return `Browser navigation failed: ${detail}`;
}

function getBlockedSummary(result: StagehandActResult): string {
  const detail = describeActResult(result) || 'The site requires human input before the task can continue.';
  return `Browser navigation is blocked: ${detail}`;
}

function getTerminalStatus(result: StagehandActResult): 'completed' | 'failed' | 'blocked' | null {
  const detail = describeActResult(result);
  if (isBlockedMessage(detail)) {
    return 'blocked';
  }

  if (!result.success) {
    return 'failed';
  }

  return isCompletionMessage(result.message) ? 'completed' : null;
}

function buildRecoveryInstruction(intent: string, currentUrl: string, detail: string): string {
  return [
    `Continue working toward: ${intent}.`,
    `The previous attempt failed with: ${detail}.`,
    `Current page: ${currentUrl}.`,
    'Reassess the UI, dismiss overlays or popups, wait for loading if needed, and try a different safe approach.',
  ].join(' ');
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
      // Use the new headless mode — harder to detect than the old --headless flag
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        // Remove the most common bot-detection signal: navigator.webdriver = true
        '--disable-blink-features=AutomationControlled',
        // Avoid renderer crashpad that leaks automation signals
        '--disable-crash-reporter',
        '--disable-extensions',
        // Realistic window size (avoids 0x0 or unusual viewport flags)
        '--window-size=1366,768',
        // Hide infobars ("Chrome is being controlled by automated software")
        '--disable-infobars',
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

    // Restore saved cookies for the target domain before navigating
    if (options.userId && options.startUrl) {
      const domain = extractApexDomain(options.startUrl);
      const savedCookies = loadUserCookies(options.userId, domain);
      if (savedCookies.length > 0) {
        try {
          await stagehand.context.addCookies(savedCookies as Parameters<typeof stagehand.context.addCookies>[0]);
        } catch {
          // Non-fatal — if cookies are stale or malformed just proceed fresh
        }
      }
    }

    // Navigate to start URL if provided
    if (options.startUrl) {
      await activePage.goto(options.startUrl, { waitUntil: 'domcontentloaded' });
    }

    // Emit initial screenshot
    await emitStepScreenshot(activePage, activePage.url(), 0, onStepScreenshot);

    let stepIndex = 0;
    let lastUrl = activePage.url();
    let recoveryInstruction: string | null = null;

    // Stagehand's act() drives one meaningful action per call.
    // We loop up to maxSteps, asking Stagehand to progress toward the intent.
    while (stepIndex < maxSteps) {
      let actResult: StagehandActResult;

      try {
        const instruction = recoveryInstruction
          ?? (stepIndex === 0
            ? intent
            : `Continue working toward: ${intent}. Current page: ${activePage.url()}`);

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
      const detail = describeActResult(actResult);

      if (!actResult.success && !recoveryInstruction && isRetryableFailure(detail) && !isBlockedMessage(detail)) {
        steps.push({
          action: {
            type: 'fail',
            error: detail,
            reasoning: 'Transient browser issue detected; retrying with recovery guidance.',
            safety: 'safe',
          },
          status: 'retried',
          url: lastUrl,
          detail: `Retrying after transient browser issue: ${detail}`,
        });

        await emitStepScreenshot(activePage, lastUrl, stepIndex + 1, onStepScreenshot);

        recoveryInstruction = buildRecoveryInstruction(intent, lastUrl, detail);
        stepIndex += 1;
        continue;
      }

      const terminalStatus = getTerminalStatus(actResult);

      const stepStatus = terminalStatus === 'blocked'
        ? 'blocked'
        : actResult.success
          ? 'completed'
          : 'failed';

      steps.push({
        action: {
          type: 'click',
          selector: actResult.actionDescription ?? 'stagehand-action',
          reasoning: actResult.message,
          safety: 'safe',
        },
        status: stepStatus,
        url: lastUrl,
        detail: actResult.actionDescription || actResult.message,
      });

      await emitStepScreenshot(activePage, lastUrl, stepIndex + 1, onStepScreenshot);

      stepIndex += 1;
      recoveryInstruction = null;
      if (terminalStatus === 'failed') {
        return {
          status: 'failed',
          steps,
          finalUrl: lastUrl,
          summary: getFailureSummary(actResult),
        };
      }

      if (terminalStatus === 'blocked') {
        return {
          status: 'blocked',
          steps,
          finalUrl: lastUrl,
          summary: getBlockedSummary(actResult),
        };
      }

      if (terminalStatus === 'completed') {
        // Capture final screenshot for vision verification
        let finalScreenshotBase64 = '';
        try {
          const buf = await activePage.screenshot({ type: 'jpeg', quality: 75 });
          finalScreenshotBase64 = Buffer.isBuffer(buf) ? buf.toString('base64') : '';
        } catch {
          // Non-fatal
        }

        const baseSummary = buildSummary(intent, steps, lastUrl);
        const verificationNote = await verifyTaskCompletion(intent, finalScreenshotBase64);
        const summary = verificationNote
          ? `${baseSummary}\n\nVerification: ${verificationNote}`
          : baseSummary;

        return {
          status: 'completed',
          steps,
          finalUrl: lastUrl,
          summary,
        };
      }
    }

    return {
      status: 'max_steps',
      steps,
      finalUrl: lastUrl,
      summary: `UI navigator reached the ${maxSteps}-step limit. Consider breaking the task into smaller steps.`,
    };
  } finally {
    // Save cookies for any domains visited so next task can reuse sessions
    if (options.userId) {
      try {
        const allCookies = await stagehand.context.cookies() as StoredCookie[];
        // Group cookies by apex domain and save each group
        const byDomain = new Map<string, StoredCookie[]>();
        for (const cookie of allCookies) {
          const apex = extractApexDomain(cookie.domain.replace(/^\./, ''));
          if (!byDomain.has(apex)) byDomain.set(apex, []);
          byDomain.get(apex)!.push(cookie);
        }
        for (const [domain, cookies] of byDomain) {
          saveUserCookies(options.userId, domain, cookies);
        }
      } catch {
        // Non-fatal — browser may have already closed
      }
    }

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
