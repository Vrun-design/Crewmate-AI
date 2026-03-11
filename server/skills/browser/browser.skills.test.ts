import { beforeEach, describe, expect, test, vi } from 'vitest';

const isFeatureEnabled = vi.fn();
const inspectVisibleUi = vi.fn();
const clickElement = vi.fn();
const typeIntoElement = vi.fn();
const pressPageKey = vi.fn();
const scrollBrowserPage = vi.fn();
const extractTextFromPage = vi.fn();
const navigateWithUiPlanner = vi.fn();

vi.mock('../../services/featureFlagService', () => ({
  isFeatureEnabled,
}));

vi.mock('../../services/browserEngine', () => ({
  inspectVisibleUi,
  clickElement,
  typeIntoElement,
  pressPageKey,
  scrollBrowserPage,
  extractTextFromPage,
  navigateWithUiPlanner,
  openUrl: vi.fn(),
  extractContent: vi.fn(),
  fillForm: vi.fn(),
  searchGoogle: vi.fn(),
  takeScreenshot: vi.fn(),
}));

describe('browser UI skills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('blocks UI navigator skills when the feature flag is disabled', async () => {
    isFeatureEnabled.mockReturnValue(false);
    const { browserUiNavigateSkill } = await import('./browser.skills');

    await expect(browserUiNavigateSkill.handler(
      { userId: 'user-1', workspaceId: 'workspace-1' },
      { intent: 'Click signup' },
    )).rejects.toThrow(/FEATURE_UI_NAVIGATOR/);
  });

  test('inspects visible UI when enabled', async () => {
    isFeatureEnabled.mockReturnValue(true);
    inspectVisibleUi.mockResolvedValue({
      url: 'https://example.com',
      title: 'Example',
      elements: [{ selector: '#signup' }],
    });

    const { browserInspectVisibleUiSkill } = await import('./browser.skills');
    const result = await browserInspectVisibleUiSkill.handler(
      { userId: 'user-1', workspaceId: 'workspace-1' },
      { url: 'https://example.com' },
    );

    expect(result.success).toBe(true);
    expect(inspectVisibleUi).toHaveBeenCalledWith('https://example.com');
  });

  test('delegates direct browser UI actions to browser engine helpers', async () => {
    isFeatureEnabled.mockReturnValue(true);
    clickElement.mockResolvedValue({ success: true, resultUrl: 'https://example.com', message: 'Clicked #cta' });
    typeIntoElement.mockResolvedValue({ success: true, resultUrl: 'https://example.com', message: 'Typed into #email' });
    pressPageKey.mockResolvedValue({ success: true, resultUrl: 'https://example.com', message: 'Pressed Enter' });
    scrollBrowserPage.mockResolvedValue({ success: true, resultUrl: 'https://example.com', message: 'Scrolled down' });
    extractTextFromPage.mockResolvedValue({ success: true, resultUrl: 'https://example.com', text: 'Hello', message: 'Extracted text' });

    const {
      browserClickElementSkill,
      browserTypeIntoSkill,
      browserPressKeySkill,
      browserScrollPageSkill,
      browserExtractTextSkill,
    } = await import('./browser.skills');

    await browserClickElementSkill.handler({ userId: 'user-1', workspaceId: 'workspace-1' }, { url: 'https://example.com', selector: '#cta' });
    await browserTypeIntoSkill.handler({ userId: 'user-1', workspaceId: 'workspace-1' }, { url: 'https://example.com', selector: '#email', value: 'user@example.com' });
    await browserPressKeySkill.handler({ userId: 'user-1', workspaceId: 'workspace-1' }, { url: 'https://example.com', key: 'Enter' });
    await browserScrollPageSkill.handler({ userId: 'user-1', workspaceId: 'workspace-1' }, { url: 'https://example.com', direction: 'down', amount: 300 });
    await browserExtractTextSkill.handler({ userId: 'user-1', workspaceId: 'workspace-1' }, { url: 'https://example.com', selector: '.headline' });

    expect(clickElement).toHaveBeenCalledWith('https://example.com', '#cta');
    expect(typeIntoElement).toHaveBeenCalledWith('https://example.com', '#email', 'user@example.com');
    expect(pressPageKey).toHaveBeenCalledWith('https://example.com', 'Enter');
    expect(scrollBrowserPage).toHaveBeenCalledWith('https://example.com', 'down', 300);
    expect(extractTextFromPage).toHaveBeenCalledWith('https://example.com', '.headline');
  });

  test('runs planner-backed UI navigation when enabled', async () => {
    isFeatureEnabled.mockReturnValue(true);
    navigateWithUiPlanner.mockResolvedValue({
      status: 'completed',
      steps: [],
      finalUrl: 'https://example.com',
      summary: 'Done',
    });

    const { browserUiNavigateSkill } = await import('./browser.skills');
    const result = await browserUiNavigateSkill.handler(
      { userId: 'user-1', workspaceId: 'workspace-1' },
      { intent: 'Complete signup', startUrl: 'https://example.com', maxSteps: 4 },
    );

    expect(result.success).toBe(true);
    expect(navigateWithUiPlanner).toHaveBeenCalledWith('Complete signup', {
      startUrl: 'https://example.com',
      maxSteps: 4,
    });
  });
});
