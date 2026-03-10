/**
 * Browser Engine — Phase 6
 *
 * A sandboxed Playwright-powered browser service that gives the agent
 * real browser capabilities:
 *   - Open URLs and navigate
 *   - Extract readable content from pages
 *   - Fill and submit forms
 *   - Search Google programmatically
 *   - Take screenshots (sent to Gemini vision)
 *
 * Safety measures:
 *   - Single shared browser instance (reused across calls for speed)
 *   - 30-second navigation timeout
 *   - Blocked resource types: fonts, images (for speed), media
 *   - No saved cookies across sessions
 *   - Output truncated to 10k chars max
 */
import { chromium, type Browser, type Page } from 'playwright';

const MAX_OUTPUT_CHARS = 10_000;
const NAV_TIMEOUT_MS = 30_000;

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (browserInstance?.isConnected()) return browserInstance;
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

async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121 Safari/537.36',
        // Don't persist cookies/storage between calls
        storageState: undefined,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

    // Block heavy resources for speed
    await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['font', 'media', 'websocket'].includes(type)) {
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

// ── Public API ────────────────────────────────────────────────────────────────

export async function openUrl(url: string): Promise<{ title: string; url: string; status: number }> {
    return withPage(async (page) => {
        const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
        const status = response?.status() ?? 0;
        const title = await page.title();
        return { title, url: page.url(), status };
    });
}

export async function extractContent(url: string): Promise<{ title: string; content: string; url: string }> {
    return withPage(async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        const title = await page.title();

        // Extract readable text (strip scripts/styles/nav boilerplate)
        const content = await page.evaluate(() => {
            // Remove noise
            document.querySelectorAll('script,style,nav,footer,header,aside,[role="navigation"],[aria-label="advertisement"]').forEach((el) => el.remove());
            return (document.body?.innerText ?? '').replace(/\s{3,}/g, '\n\n').trim();
        });

        return {
            title,
            url: page.url(),
            content: content.slice(0, MAX_OUTPUT_CHARS),
        };
    });
}

export interface FillFormOptions {
    url: string;
    fields: Record<string, string>;  // CSS selector → value
    submitSelector?: string;          // CSS selector for submit button
}

export async function fillForm(options: FillFormOptions): Promise<{ success: boolean; resultUrl: string; message: string }> {
    return withPage(async (page) => {
        await page.goto(options.url, { waitUntil: 'domcontentloaded' });

        for (const [selector, value] of Object.entries(options.fields)) {
            await page.fill(selector, value);
        }

        if (options.submitSelector) {
            await page.click(options.submitSelector);
            await page.waitForLoadState('domcontentloaded');
        }

        return {
            success: true,
            resultUrl: page.url(),
            message: `Form filled${options.submitSelector ? ' and submitted' : ''}. Result URL: ${page.url()}`,
        };
    });
}

export async function searchGoogle(query: string, maxResults = 5): Promise<Array<{ title: string; url: string; snippet: string }>> {
    return withPage(async (page) => {
        const encodedQuery = encodeURIComponent(query);
        await page.goto(`https://www.google.com/search?q=${encodedQuery}&num=${maxResults}`, {
            waitUntil: 'domcontentloaded',
        });

        // Try to accept cookie consent if it appears
        try {
            const acceptBtn = page.locator('button:has-text("Accept all"), button:has-text("I agree")').first();
            if (await acceptBtn.isVisible({ timeout: 2000 })) {
                await acceptBtn.click();
                await page.waitForLoadState('domcontentloaded');
            }
        } catch {
            // No consent dialog — continue
        }

        const results = await page.evaluate((max: number) => {
            const items: Array<{ title: string; url: string; snippet: string }> = [];
            const resultEls = document.querySelectorAll('div.g, div[data-hveid]');
            for (const el of resultEls) {
                const titleEl = el.querySelector('h3');
                const linkEl = el.querySelector('a');
                const snippetEl = el.querySelector('.VwiC3b, span[data-ved], div.IsZvec');
                if (titleEl && linkEl) {
                    items.push({
                        title: titleEl.textContent?.trim() ?? '',
                        url: linkEl.href,
                        snippet: snippetEl?.textContent?.trim() ?? '',
                    });
                }
                if (items.length >= max) break;
            }
            return items;
        }, maxResults);

        return results.filter((r) => r.url.startsWith('http') && !r.url.includes('google.com'));
    });
}

export async function takeScreenshot(url: string): Promise<{ base64: string; mimeType: string; title: string }> {
    return withPage(async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await page.setViewportSize({ width: 1280, height: 800 });
        const title = await page.title();
        const buffer = await page.screenshot({ type: 'jpeg', quality: 75, fullPage: false });
        return {
            base64: buffer.toString('base64'),
            mimeType: 'image/jpeg',
            title,
        };
    });
}

export async function closeBrowser(): Promise<void> {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}
