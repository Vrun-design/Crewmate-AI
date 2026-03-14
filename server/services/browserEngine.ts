/**
 * Browser Engine — Phase 6
 *
 * Backward-compatible facade around the modular UI navigator browser services.
 */
import { clickBySelector, extractText, openPage, pressKey, scrollPage, type BrowserActionResult, typeBySelector, waitForSelector } from './uiNavigator/browserActions';
import { createUiNavigatorExecutor, observeUiState } from './uiNavigator/uiNavigatorExecutor';
import { takeViewportScreenshot } from './uiNavigator/browserScreenshot';
import { withBrowserPage, closeBrowser } from './uiNavigator/browserSession';
import type { UiNavigatorRunResult, UiObservation } from './uiNavigator/uiNavigatorTypes';

const MAX_OUTPUT_CHARS = 10_000;

// ── Public API ────────────────────────────────────────────────────────────────

export async function openUrl(url: string): Promise<{ title: string; url: string; status: number }> {
    return withBrowserPage(async (page) => openPage(page, url));
}

export async function extractContent(url: string): Promise<{ title: string; content: string; url: string }> {
    return withBrowserPage(async (page) => {
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

export interface UiPlannerStepScreenshotHandler {
  (base64: string, mimeType: string, currentUrl: string, stepIndex: number): void;
}

export interface NavigateWithUiPlannerOptions {
  startUrl?: string;
  maxSteps?: number;
  onStepScreenshot?: UiPlannerStepScreenshotHandler;
}

export async function fillForm(options: FillFormOptions): Promise<{ success: boolean; resultUrl: string; message: string }> {
    return withBrowserPage(async (page) => {
        await page.goto(options.url, { waitUntil: 'domcontentloaded' });

        for (const [selector, value] of Object.entries(options.fields)) {
            await typeBySelector(page, selector, value);
        }

        if (options.submitSelector) {
            await clickBySelector(page, options.submitSelector);
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
    return withBrowserPage(async (page) => {
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
    return withBrowserPage(async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return takeViewportScreenshot(page);
    });
}

export async function clickElement(url: string, selector: string): Promise<BrowserActionResult> {
    return withBrowserPage(async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return clickBySelector(page, selector);
    });
}

export async function typeIntoElement(url: string, selector: string, value: string): Promise<BrowserActionResult> {
    return withBrowserPage(async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return typeBySelector(page, selector, value);
    });
}

export async function pressPageKey(url: string, key: string): Promise<BrowserActionResult> {
    return withBrowserPage(async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return pressKey(page, key);
    });
}

export async function scrollBrowserPage(url: string, direction: 'up' | 'down', amount?: number): Promise<BrowserActionResult> {
    return withBrowserPage(async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return scrollPage(page, direction, amount);
    });
}

export async function waitForPageSelector(url: string, selector: string, timeoutMs?: number): Promise<BrowserActionResult> {
    return withBrowserPage(async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return waitForSelector(page, selector, timeoutMs);
    });
}

export async function extractTextFromPage(url: string, selector: string): Promise<{ success: boolean; resultUrl: string; text: string; message: string }> {
    return withBrowserPage(async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return extractText(page, selector);
    });
}

export async function inspectVisibleUi(url: string): Promise<UiObservation> {
    return withBrowserPage(async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return observeUiState(page, []);
    });
}

export async function navigateWithUiPlanner(
    intent: string,
    options: NavigateWithUiPlannerOptions = {},
): Promise<UiNavigatorRunResult> {
    const executor = createUiNavigatorExecutor();
    return executor.execute(intent, options);
}
