import type { Page } from 'playwright';
import {
  clickBySelector,
  extractText,
  openPage,
  pressKey,
  scrollPage,
  type BrowserActionResult,
  typeBySelector,
  waitForSelector,
} from './browserActions';
import { dismissOverlays, extractAccessibilityTree, extractVisibleElements } from './browserObservation';
import { takeViewportScreenshot } from './browserScreenshot';
import { withBrowserPage } from './browserSession';
import { createUiNavigatorPlanner } from './uiNavigatorPlanner';
import type {
  UiAction,
  UiExecutionResult,
  UiNavigatorRunResult,
  UiObservation,
  UiPlan,
} from './uiNavigatorTypes';

interface UiNavigatorExecutorOptions {
  startUrl?: string;
  maxSteps?: number;
}

interface UiNavigatorPlanner {
  planNextAction(intent: string, observation: UiObservation): Promise<UiPlan>;
}

interface UiNavigatorExecutorDeps {
  planner?: UiNavigatorPlanner;
  observeUiState?: (page: Page, history: UiExecutionResult[]) => Promise<UiObservation>;
  withPage?: <T>(fn: (page: Page) => Promise<T>) => Promise<T>;
}

function getBlockedResult(action: UiAction, url: string, detail: string): UiExecutionResult {
  return { action, status: 'blocked', url, detail };
}

function getFailedResult(action: UiAction, url: string, detail: string): UiExecutionResult {
  return { action, status: 'failed', url, detail };
}

function getCompletedResult(action: UiAction, url: string, detail: string): UiExecutionResult {
  return { action, status: 'completed', url, detail };
}

function getRetriedResult(action: UiAction, url: string, detail: string): UiExecutionResult {
  return { action, status: 'retried', url, detail };
}

function getCurrentUrl(page: Page): string {
  try { return page.url(); } catch { return 'about:blank'; }
}

function toExecutionResult(action: UiAction, result: BrowserActionResult): UiExecutionResult {
  return getCompletedResult(action, result.resultUrl, result.message);
}

async function clickWithFallback(
  page: Page,
  selector: string,
  alternativeSelectors: string[] = [],
  textHint?: string,
): Promise<BrowserActionResult> {
  const allSelectors = [selector, ...alternativeSelectors];
  let lastError: string | null = null;

  for (const sel of allSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 2000, state: 'visible' });
      await page.click(sel, { timeout: 3000 });
      return { success: true, resultUrl: page.url(), message: `Clicked ${sel}` };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (textHint) {
    try {
      await page.locator(`text=${textHint}`).first().click({ timeout: 3000 });
      return { success: true, resultUrl: page.url(), message: `Clicked text="${textHint}"` };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  const errorSuffix = lastError ? ` Last error: ${lastError}` : '';
  throw new Error(`Could not click any of: ${allSelectors.join(', ')}.${errorSuffix}`);
}

async function typeWithFallback(
  page: Page,
  selector: string,
  value: string,
  alternativeSelectors: string[] = [],
  clear = false,
): Promise<BrowserActionResult> {
  const allSelectors = [selector, ...alternativeSelectors];
  let lastError: string | null = null;

  for (const sel of allSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 2000, state: 'visible' });
      if (clear) {
        await page.fill(sel, '');
      }
      await page.fill(sel, value);
      return { success: true, resultUrl: page.url(), message: `${clear ? 'Cleared and typed' : 'Typed'} into ${sel}` };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  const primarySel = allSelectors[0];
  try {
    await page.focus(primarySel);
    if (clear) await page.keyboard.press('Control+A');
    await page.keyboard.type(value, { delay: 30 });
    return { success: true, resultUrl: page.url(), message: `Keyboard typed into ${primarySel}` };
  } catch (err) {
    const keyboardError = err instanceof Error ? err.message : String(err);
    const fallbackSuffix = lastError ? ` Last selector error: ${lastError}.` : '';
    throw new Error(`Could not type into any of: ${allSelectors.join(', ')}.${fallbackSuffix} Keyboard fallback failed: ${keyboardError}`);
  }
}

function getConsecutiveFailedSteps(steps: UiExecutionResult[], windowSize = 4): number {
  return steps.slice(-windowSize).filter((step) => step.status === 'failed').length;
}

export async function observeUiState(page: Page, history: UiExecutionResult[]): Promise<UiObservation> {
  const [screenshot, elements, accessibilityTree] = await Promise.all([
    takeViewportScreenshot(page),
    extractVisibleElements(page),
    extractAccessibilityTree(page),
  ]);

  return {
    url: page.url(),
    title: screenshot.title,
    screenshotBase64: screenshot.base64,
    screenshotMimeType: screenshot.mimeType,
    elements,
    accessibilityTree: accessibilityTree || undefined,
    history,
  };
}

export async function executeUiAction(page: Page, action: UiAction): Promise<UiExecutionResult> {
  switch (action.type) {
    case 'open_url':
      return getCompletedResult(action, (await openPage(page, action.url)).url, `Opened ${action.url}`);

    case 'click': {
      const textHint = action.selector.includes('text=')
        ? action.selector.replace(/^text=/, '')
        : undefined;
      const result = await clickWithFallback(page, action.selector, action.alternativeSelectors, textHint);
      return getCompletedResult(action, result.resultUrl, result.message);
    }

    case 'type':
      return toExecutionResult(action, await typeWithFallback(page, action.selector, action.value, action.alternativeSelectors, false));

    case 'clear_and_type':
      return toExecutionResult(action, await typeWithFallback(page, action.selector, action.value, action.alternativeSelectors, true));

    case 'select_option':
      await page.selectOption(action.selector, action.value);
      return getCompletedResult(action, page.url(), `Selected "${action.value}" in ${action.selector}`);

    case 'check': {
      const locator = page.locator(action.selector).first();
      const isChecked = await locator.isChecked();
      if (isChecked !== action.checked) {
        await locator.click();
      }
      return getCompletedResult(action, page.url(), `${action.checked ? 'Checked' : 'Unchecked'} ${action.selector}`);
    }

    case 'hover':
      await page.hover(action.selector);
      return getCompletedResult(action, page.url(), `Hovered over ${action.selector}`);

    case 'press_key':
      return toExecutionResult(action, await pressKey(page, action.key));

    case 'scroll':
      return toExecutionResult(action, await scrollPage(page, action.direction, action.amount));

    case 'wait_for':
      return toExecutionResult(action, await waitForSelector(page, action.selector, action.timeoutMs));

    case 'wait_for_url':
      await page.waitForURL(action.urlPattern, { timeout: action.timeoutMs ?? 10000 });
      return getCompletedResult(action, page.url(), `URL changed to match: ${action.urlPattern}`);

    case 'dismiss_overlay': {
      const dismissed = await dismissOverlays(page);
      return getCompletedResult(action, page.url(), dismissed ? `Dismissed: ${dismissed}` : 'No overlay found');
    }

    case 'extract_text': {
      const result = await extractText(page, action.selector);
      return getCompletedResult(action, result.resultUrl, `${result.message}: ${result.text}`);
    }

    case 'finish':
      return getCompletedResult(action, getCurrentUrl(page), action.summary);

    case 'request_confirmation':
      return getBlockedResult(action, getCurrentUrl(page), action.summary);

    case 'fail':
      return getFailedResult(action, getCurrentUrl(page), action.error);
  }
}

const MAX_ACTION_RETRIES = 2;

export function createUiNavigatorExecutor(deps: UiNavigatorExecutorDeps = {}): {
  execute(intent: string, options?: UiNavigatorExecutorOptions): Promise<UiNavigatorRunResult>;
} {
  const planner = deps.planner ?? createUiNavigatorPlanner();
  const observe = deps.observeUiState ?? observeUiState;
  const runWithPage = deps.withPage ?? withBrowserPage;

  return {
    async execute(intent: string, options: UiNavigatorExecutorOptions = {}): Promise<UiNavigatorRunResult> {
      const maxSteps = options.maxSteps ?? 20;

      return runWithPage(async (page) => {
        const steps: UiExecutionResult[] = [];

        if (options.startUrl) {
          await openPage(page, options.startUrl);
          await dismissOverlays(page);
        }

        for (let stepIndex = 0; stepIndex < maxSteps; stepIndex += 1) {
          const observation = await observe(page, steps);
          const plan = await planner.planNextAction(intent, observation);

          if (plan.action.safety !== 'safe') {
            const blocked = getBlockedResult(
              plan.action,
              observation.url,
              plan.action.type === 'request_confirmation'
                ? plan.action.summary
                : `Blocked ${plan.action.type} action — safety level: ${plan.action.safety}`,
            );
            steps.push(blocked);
            return {
              status: 'blocked',
              steps,
              finalUrl: observation.url,
              finalObservation: observation,
              summary: blocked.detail,
            };
          }

          let lastError: string | null = null;
          let succeeded = false;

          for (let attempt = 0; attempt <= MAX_ACTION_RETRIES; attempt += 1) {
            try {
              const result = await executeUiAction(page, plan.action);

              if (attempt > 0) {
                steps.push(getRetriedResult(plan.action, result.url, `Retry ${attempt} succeeded: ${result.detail}`));
              } else {
                steps.push(result);
              }

              if (plan.action.type === 'finish') {
                const finalObservation = await observe(page, steps);
                return {
                  status: 'completed',
                  steps,
                  finalUrl: finalObservation.url,
                  finalObservation,
                  summary: result.detail,
                };
              }

              if (plan.action.type === 'request_confirmation') {
                return {
                  status: 'blocked',
                  steps,
                  finalUrl: observation.url,
                  finalObservation: observation,
                  summary: result.detail,
                };
              }

              succeeded = true;
              break;
            } catch (error) {
              lastError = error instanceof Error ? error.message : 'Unknown UI navigation error';
              if (attempt < MAX_ACTION_RETRIES) {
                await new Promise((resolve) => setTimeout(resolve, 800));
              }
            }
          }

          if (!succeeded) {
            steps.push(getFailedResult(plan.action, observation.url, lastError ?? 'Action failed after retries'));

            const consecutiveFails = getConsecutiveFailedSteps(steps);
            if (consecutiveFails >= 3) {
              return {
                status: 'failed',
                steps,
                finalUrl: observation.url,
                finalObservation: observation,
                summary: `Stopped after ${consecutiveFails} consecutive failures. Last error: ${lastError}`,
              };
            }
          }
        }

        const finalObservation = await observe(page, steps);
        return {
          status: 'max_steps',
          steps,
          finalUrl: finalObservation.url,
          finalObservation,
          summary: `UI navigator reached the ${maxSteps}-step limit.`,
        };
      });
    },
  };
}
