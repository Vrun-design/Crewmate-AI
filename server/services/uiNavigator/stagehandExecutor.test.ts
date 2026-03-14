import { beforeEach, describe, expect, test, vi } from 'vitest';

const initMock = vi.fn();
const closeMock = vi.fn();
const gotoMock = vi.fn();
const screenshotMock = vi.fn();
const urlMock = vi.fn();
const actMock = vi.fn();

vi.mock('@browserbasehq/stagehand', () => {
  class MockStagehand {
    context = {
      activePage: () => ({
        goto: gotoMock,
        screenshot: screenshotMock,
        url: urlMock,
      }),
    };

    init = initMock;
    close = closeMock;
    act = actMock;

    constructor(_options: unknown) {}
  }

  return { Stagehand: MockStagehand };
});

describe('stagehandExecutor', () => {
  beforeEach(() => {
    initMock.mockReset().mockResolvedValue(undefined);
    closeMock.mockReset().mockResolvedValue(undefined);
    gotoMock.mockReset().mockResolvedValue(undefined);
    screenshotMock.mockReset().mockResolvedValue(Buffer.from('image'));
    urlMock.mockReset().mockReturnValue('https://example.com');
    actMock.mockReset();
  });

  test('returns failed when Stagehand reports an unsuccessful action', async () => {
    const { executeWithStagehand } = await import('./stagehandExecutor');

    actMock.mockResolvedValue({
      success: false,
      message: 'Could not find the submit button',
      actionDescription: 'submit-button',
    });

    const result = await executeWithStagehand('Submit the form', { maxSteps: 2 });

    expect(result.status).toBe('failed');
    expect(result.summary).toContain('Could not find the submit button');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.status).toBe('failed');
  });

  test('returns blocked when Stagehand reports a human-required blocker', async () => {
    const { executeWithStagehand } = await import('./stagehandExecutor');

    actMock.mockResolvedValue({
      success: false,
      message: 'Login required before continuing',
      actionDescription: 'sign-in wall',
    });

    const result = await executeWithStagehand('Open billing settings', { maxSteps: 2 });

    expect(result.status).toBe('blocked');
    expect(result.summary).toContain('blocked');
    expect(result.summary).toContain('Login required');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.status).toBe('blocked');
  });

  test('returns completed when Stagehand reports a completion message', async () => {
    const { executeWithStagehand } = await import('./stagehandExecutor');

    actMock.mockResolvedValue({
      success: true,
      message: 'Done - the account settings page is open',
      actionDescription: 'opened settings',
    });

    const result = await executeWithStagehand('Open account settings', { maxSteps: 2 });

    expect(result.status).toBe('completed');
    expect(result.summary).toContain('Completed "Open account settings"');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]?.status).toBe('completed');
  });

  test('retries once after a transient failure and can still complete', async () => {
    const { executeWithStagehand } = await import('./stagehandExecutor');

    actMock
      .mockResolvedValueOnce({
        success: false,
        message: 'Element click timed out behind overlay',
        actionDescription: 'pricing-link',
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'Done - pricing page is open',
        actionDescription: 'pricing-page',
      });

    const result = await executeWithStagehand('Open pricing', { maxSteps: 3 });

    expect(result.status).toBe('completed');
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]?.status).toBe('retried');
    expect(result.steps[1]?.status).toBe('completed');
    expect(actMock).toHaveBeenCalledTimes(2);
    expect(actMock.mock.calls[1]?.[0]).toContain('previous attempt failed');
  });

  test('emits screenshots for the initial frame and each executed step', async () => {
    const { executeWithStagehand } = await import('./stagehandExecutor');
    const onStepScreenshot = vi.fn();

    actMock
      .mockResolvedValueOnce({
        success: true,
        message: 'Clicked the pricing link',
        actionDescription: 'pricing-link',
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'Done - pricing page is open',
        actionDescription: 'pricing-page',
      });

    await executeWithStagehand('Open pricing', { maxSteps: 3 }, onStepScreenshot);

    expect(onStepScreenshot).toHaveBeenCalledTimes(3);
    expect(onStepScreenshot).toHaveBeenNthCalledWith(1, expect.any(String), 'image/jpeg', 'https://example.com', 0);
    expect(onStepScreenshot).toHaveBeenNthCalledWith(2, expect.any(String), 'image/jpeg', 'https://example.com', 1);
    expect(onStepScreenshot).toHaveBeenNthCalledWith(3, expect.any(String), 'image/jpeg', 'https://example.com', 2);
  });
});
