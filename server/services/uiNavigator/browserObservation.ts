import type { UiObservation } from './uiNavigatorTypes';

// Patterns for common overlay dismiss buttons — ordered by specificity
const OVERLAY_DISMISS_SELECTORS = [
  // Cookie consent
  'button:has-text("Accept all")',
  'button:has-text("Accept All")',
  'button:has-text("Accept cookies")',
  'button:has-text("I agree")',
  'button:has-text("Agree")',
  'button:has-text("Got it")',
  'button:has-text("OK")',
  'button:has-text("Allow all")',
  'button:has-text("Allow All")',
  '#onetrust-accept-btn-handler',
  '[data-cookiefirst-action="accept"]',
  '.cookie-accept',
  '.js-accept-cookies',
  // Newsletter / modal closes
  'button:has-text("No thanks")',
  'button:has-text("Not now")',
  'button:has-text("Maybe later")',
  'button[aria-label="Close"]',
  'button[aria-label="close"]',
  'button[aria-label="Dismiss"]',
  '[data-testid="modal-close"]',
  '.modal-close',
  '.popup-close',
  // GDPR
  'button:has-text("Reject all")',
  'button:has-text("Decline")',
];

/**
 * Best-effort overlay dismissal. Tries each dismiss selector in sequence and stops
 * after the first successful interaction. Silent on all failures — never throws.
 */
export async function dismissOverlays(page: import('playwright').Page): Promise<string | null> {
  for (const selector of OVERLAY_DISMISS_SELECTORS) {
    try {
      const element = page.locator(selector).first();
      const isVisible = await element.isVisible({ timeout: 400 }).catch(() => false);
      if (isVisible) {
        await element.click({ timeout: 1000 });
        return selector;
      }
    } catch {
      // Not found or not clickable — try next
    }
  }
  return null;
}

/**
 * Extract the Playwright aria snapshot as a compact string.
 * Uses the current Playwright ariaSnapshot() API (page.accessibility was removed in v1.24).
 */
export async function extractAccessibilityTree(page: import('playwright').Page): Promise<string> {
  try {
    const snapshot = await page.locator('body').ariaSnapshot({ timeout: 2000 });
    return snapshot.slice(0, 3000);
  } catch {
    return '';
  }
}

export const MAX_UI_ELEMENT_CANDIDATES = 60;

export function buildFallbackSelector(tagName: string, index: number): string {
  return `${tagName.toLowerCase()}:nth-of-type(${index + 1})`;
}

export async function extractVisibleElements(page: import('playwright').Page): Promise<import('./uiNavigatorTypes').UiElementCandidate[]> {
  return page.evaluate((maxCandidates) => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(
      'a, button, input, textarea, select, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="combobox"], [role="menuitem"], [role="tab"], label',
    ));

    return nodes.slice(0, maxCandidates).map((node, index) => {
      const rect = node.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight + 200;
      const tagName = node.tagName.toLowerCase();

      const selector = node.id
        ? `#${node.id}`
        : node.getAttribute('data-testid')
          ? `[data-testid="${node.getAttribute('data-testid')}"]`
            : node.getAttribute('name')
              ? `${tagName}[name="${node.getAttribute('name')}"]`
              : `${tagName}:nth-of-type(${index + 1})`;

      return {
        selector,
        tagName,
        role: node.getAttribute('role') ?? node.tagName.toLowerCase(),
        text: (node.innerText ?? node.textContent ?? '').trim().slice(0, 100),
        ariaLabel: node.getAttribute('aria-label') ?? node.getAttribute('aria-labelledby') ?? '',
        placeholder: 'placeholder' in node ? (node.getAttribute('placeholder') ?? '') : '',
        type: node.getAttribute('type') ?? '',
        bounds: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        isVisible,
        isClickable: ['a', 'button', 'label'].includes(tagName) || ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio'].includes(node.getAttribute('role') ?? ''),
        isEditable: ['input', 'textarea', 'select'].includes(tagName),
      };
    }).filter((candidate) => candidate.isVisible);
  }, MAX_UI_ELEMENT_CANDIDATES);
}
