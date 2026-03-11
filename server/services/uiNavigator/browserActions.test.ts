import { describe, expect, test, vi } from 'vitest';
import { clickBySelector, extractText, openPage, pressKey, scrollPage, typeBySelector, waitForSelector } from './browserActions';

describe('browserActions', () => {
  test('opens a page and returns title/status', async () => {
    const page = {
      goto: vi.fn().mockResolvedValue({ status: () => 200 }),
      title: vi.fn().mockResolvedValue('Example'),
      url: vi.fn().mockReturnValue('https://example.com'),
    };

    const result = await openPage(page as never, 'https://example.com');

    expect(result).toEqual({
      title: 'Example',
      url: 'https://example.com',
      status: 200,
    });
  });

  test('clicks and types using selectors', async () => {
    const page = {
      click: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      url: vi.fn().mockReturnValue('https://example.com/form'),
    };

    await clickBySelector(page as never, '#submit');
    await typeBySelector(page as never, '#email', 'user@example.com');

    expect(page.click).toHaveBeenCalledWith('#submit');
    expect(page.fill).toHaveBeenCalledWith('#email', 'user@example.com');
  });

  test('presses keys and scrolls', async () => {
    const page = {
      keyboard: { press: vi.fn().mockResolvedValue(undefined) },
      mouse: { wheel: vi.fn().mockResolvedValue(undefined) },
      url: vi.fn().mockReturnValue('https://example.com'),
    };

    await pressKey(page as never, 'Enter');
    await scrollPage(page as never, 'down', 300);

    expect(page.keyboard.press).toHaveBeenCalledWith('Enter');
    expect(page.mouse.wheel).toHaveBeenCalledWith(0, 300);
  });

  test('waits for selectors and extracts text', async () => {
    const textContent = vi.fn().mockResolvedValue(' Hello world ');
    const locator = vi.fn().mockReturnValue({ first: () => ({ textContent }) });
    const page = {
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      locator,
      url: vi.fn().mockReturnValue('https://example.com'),
    };

    const waitResult = await waitForSelector(page as never, '.ready', 1200);
    const extractResult = await extractText(page as never, '.title');

    expect(page.waitForSelector).toHaveBeenCalledWith('.ready', { timeout: 1200, state: 'visible' });
    expect(extractResult.text).toBe('Hello world');
    expect(waitResult.success).toBe(true);
  });
});
