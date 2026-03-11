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
import { extractVisibleElements } from './browserObservation';
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
  return {
    action,
    status: 'blocked',
    url,
    detail,
  };
}

function getFailedResult(action: UiAction, url: string, detail: string): UiExecutionResult {
  return {
    action,
    status: 'failed',
    url,
    detail,
  };
}

function getCompletedResult(action: UiAction, url: string, detail: string): UiExecutionResult {
  return {
    action,
    status: 'completed',
    url,
    detail,
  };
}

function getCurrentUrl(page: Page): string {
  try {
    return page.url();
  } catch {
    return 'about:blank';
  }
}

function toExecutionResult(action: UiAction, result: BrowserActionResult): UiExecutionResult {
  return getCompletedResult(action, result.resultUrl, result.message);
}

export async function observeUiState(page: Page, history: UiExecutionResult[]): Promise<UiObservation> {
  const screenshot = await takeViewportScreenshot(page);
  const elements = await extractVisibleElements(page);

  return {
    url: page.url(),
    title: screenshot.title,
    screenshotBase64: screenshot.base64,
    screenshotMimeType: screenshot.mimeType,
    elements,
    history,
  };
}

export async function executeUiAction(page: Page, action: UiAction): Promise<UiExecutionResult> {
  switch (action.type) {
    case 'open_url':
      return getCompletedResult(action, (await openPage(page, action.url)).url, `Opened ${action.url}`);
    case 'click':
      return toExecutionResult(action, await clickBySelector(page, action.selector));
    case 'type':
      return toExecutionResult(action, await typeBySelector(page, action.selector, action.value));
    case 'press_key':
      return toExecutionResult(action, await pressKey(page, action.key));
    case 'scroll':
      return toExecutionResult(action, await scrollPage(page, action.direction, action.amount));
    case 'wait_for':
      return toExecutionResult(action, await waitForSelector(page, action.selector, action.timeoutMs));
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

export function createUiNavigatorExecutor(deps: UiNavigatorExecutorDeps = {}): {
  execute(intent: string, options?: UiNavigatorExecutorOptions): Promise<UiNavigatorRunResult>;
} {
  const planner = deps.planner ?? createUiNavigatorPlanner();
  const observe = deps.observeUiState ?? observeUiState;
  const runWithPage = deps.withPage ?? withBrowserPage;

  return {
    async execute(intent: string, options: UiNavigatorExecutorOptions = {}): Promise<UiNavigatorRunResult> {
      const maxSteps = options.maxSteps ?? 8;

      return runWithPage(async (page) => {
        const steps: UiExecutionResult[] = [];

        if (options.startUrl) {
          await openPage(page, options.startUrl);
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
                : `Blocked ${plan.action.type} action due to ${plan.action.safety} safety level.`,
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

          try {
            const result = await executeUiAction(page, plan.action);
            steps.push(result);

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
          } catch (error) {
            const failed = getFailedResult(
              plan.action,
              observation.url,
              error instanceof Error ? error.message : 'Unknown UI navigation error',
            );
            steps.push(failed);
            return {
              status: 'failed',
              steps,
              finalUrl: observation.url,
              finalObservation: observation,
              summary: failed.detail,
            };
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
