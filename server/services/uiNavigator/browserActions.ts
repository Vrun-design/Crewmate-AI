import type { Page } from 'playwright';

export interface BrowserActionResult {
  success: boolean;
  resultUrl: string;
  message: string;
}

export async function openPage(page: Page, url: string): Promise<{ title: string; url: string; status: number }> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  return {
    title: await page.title(),
    url: page.url(),
    status: response?.status() ?? 0,
  };
}

export async function clickBySelector(page: Page, selector: string): Promise<BrowserActionResult> {
  await page.click(selector);
  return {
    success: true,
    resultUrl: page.url(),
    message: `Clicked ${selector}`,
  };
}

export async function typeBySelector(page: Page, selector: string, value: string): Promise<BrowserActionResult> {
  await page.fill(selector, value);
  return {
    success: true,
    resultUrl: page.url(),
    message: `Typed into ${selector}`,
  };
}

export async function pressKey(page: Page, key: string): Promise<BrowserActionResult> {
  await page.keyboard.press(key);
  return {
    success: true,
    resultUrl: page.url(),
    message: `Pressed ${key}`,
  };
}

export async function scrollPage(page: Page, direction: 'up' | 'down', amount = 600): Promise<BrowserActionResult> {
  const delta = direction === 'down' ? amount : -amount;
  await page.mouse.wheel(0, delta);
  return {
    success: true,
    resultUrl: page.url(),
    message: `Scrolled ${direction} by ${Math.abs(delta)}px`,
  };
}

export async function waitForSelector(page: Page, selector: string, timeoutMs = 5000): Promise<BrowserActionResult> {
  await page.waitForSelector(selector, { timeout: timeoutMs, state: 'visible' });
  return {
    success: true,
    resultUrl: page.url(),
    message: `Waited for ${selector}`,
  };
}

export async function extractText(page: Page, selector: string): Promise<{ success: boolean; resultUrl: string; text: string; message: string }> {
  const locator = page.locator(selector).first();
  const text = (await locator.textContent())?.trim() ?? '';
  return {
    success: true,
    resultUrl: page.url(),
    text,
    message: `Extracted text from ${selector}`,
  };
}
