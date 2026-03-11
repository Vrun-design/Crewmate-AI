import { chromium, type Browser, type Page } from 'playwright';

const NAV_TIMEOUT_MS = 30_000;

let browserInstance: Browser | null = null;

export function shouldBlockResourceType(resourceType: string): boolean {
  return ['font', 'media', 'websocket'].includes(resourceType);
}

export async function getBrowser(): Promise<Browser> {
  if (browserInstance?.isConnected()) {
    return browserInstance;
  }

  browserInstance = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  return browserInstance;
}

export async function withBrowserPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121 Safari/537.36',
    storageState: undefined,
  });
  const page = await context.newPage();

  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (shouldBlockResourceType(resourceType)) {
      return route.abort();
    }

    return route.continue();
  });

  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (!browserInstance) {
    return;
  }

  await browserInstance.close();
  browserInstance = null;
}
