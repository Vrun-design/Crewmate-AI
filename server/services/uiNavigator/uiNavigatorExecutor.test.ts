import { describe, expect, test, vi } from 'vitest';
import { createUiNavigatorExecutor, executeUiAction } from './uiNavigatorExecutor';
import type { UiExecutionResult, UiObservation } from './uiNavigatorTypes';

function createBaseObservation(history: UiExecutionResult[] = []): UiObservation {
  return {
    url: 'https://example.com',
    title: 'Example',
    screenshotBase64: 'abc',
    screenshotMimeType: 'image/jpeg',
    elements: [],
    history,
  };
}

describe('uiNavigatorExecutor', () => {
  test('executes safe planner actions until finish', async () => {
    const page = {
      url: vi.fn().mockReturnValue('https://example.com'),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      title: vi.fn().mockResolvedValue('Example'),
      setViewportSize: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(Buffer.from('image')),
      evaluate: vi.fn().mockResolvedValue([]),
    };

    const planner = {
      planNextAction: vi
        .fn()
        .mockResolvedValueOnce({
          goal: 'Click signup',
          confidence: 0.8,
          action: { type: 'click', selector: '#signup', reasoning: 'CTA visible', safety: 'safe' },
        })
        .mockResolvedValueOnce({
          goal: 'Finish',
          confidence: 0.95,
          action: { type: 'finish', summary: 'Done', reasoning: 'Goal completed', safety: 'safe' },
        }),
    };

    const executor = createUiNavigatorExecutor({
      planner,
      withPage: async (fn) => fn(page as never),
    });

    const result = await executor.execute('Click signup');

    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(2);
    expect(page.waitForSelector).toHaveBeenCalledWith('#signup', { timeout: 2000, state: 'visible' });
    expect(page.click).toHaveBeenCalledWith('#signup', { timeout: 3000 });
  });

  test('blocks confirmation-required planner actions before execution', async () => {
    const page = {
      url: vi.fn().mockReturnValue('https://example.com/settings'),
    };

    const executor = createUiNavigatorExecutor({
      planner: {
        planNextAction: vi.fn().mockResolvedValue({
          goal: 'Delete account',
          confidence: 0.7,
          action: {
            type: 'click',
            selector: 'button[data-action="delete-account"]',
            reasoning: 'This is the requested delete button.',
            safety: 'confirmation_required',
          },
        }),
      },
      observeUiState: vi.fn().mockResolvedValue(createBaseObservation()),
      withPage: async (fn) => fn(page as never),
    });

    const result = await executor.execute('Delete my account');

    expect(result.status).toBe('blocked');
    expect(result.steps[0].status).toBe('blocked');
  });

  test('returns failed when action execution throws', async () => {
    const page = {
      url: vi.fn().mockReturnValue('https://example.com'),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockRejectedValue(new Error('selector not found')),
    };

    const executor = createUiNavigatorExecutor({
      planner: {
        planNextAction: vi.fn().mockResolvedValue({
          goal: 'Click signup',
          confidence: 0.6,
          action: { type: 'click', selector: '#signup', reasoning: 'Try signup', safety: 'safe' },
        }),
      },
      observeUiState: vi.fn().mockResolvedValue(createBaseObservation()),
      withPage: async (fn) => fn(page as never),
    });

    const result = await executor.execute('Click signup');

    expect(result.status).toBe('failed');
    expect(result.summary).toContain('selector not found');
  });

  test('executes request_confirmation as blocked and finish as completed', async () => {
    const page = {
      url: vi.fn().mockReturnValue('https://example.com'),
    };

    const finishResult = await executeUiAction(page as never, {
      type: 'finish',
      summary: 'Finished',
      reasoning: 'done',
      safety: 'safe',
    });
    const blockedResult = await executeUiAction(page as never, {
      type: 'request_confirmation',
      summary: 'Need approval',
      reasoning: 'risky',
      safety: 'confirmation_required',
    });

    expect(finishResult.status).toBe('completed');
    expect(blockedResult.status).toBe('blocked');
  });
});
