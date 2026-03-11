import type { Page } from 'playwright';

export async function takeViewportScreenshot(page: Page): Promise<{ base64: string; mimeType: string; title: string }> {
  await page.setViewportSize({ width: 1280, height: 800 });
  const title = await page.title();
  const buffer = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: false });

  return {
    base64: buffer.toString('base64'),
    mimeType: 'image/jpeg',
    title,
  };
}
